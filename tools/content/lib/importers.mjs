import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import bz2 from 'unbzip2-stream';
import { t as tarList } from 'tar';
import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { readJson, readJsonIfExists, writeJson } from './fs-utils.mjs';
import { IMPORTED_DIR, RAW_DIR } from './paths.mjs';

export function kanjidicParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) =>
      ['character', 'reading', 'meaning', 'cp_value', 'rad_value', 'stroke_count', 'grade', 'freq', 'jlpt'].includes(
        name,
      ),
  });
}

export function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export async function* gunzipLines(filePath) {
  const stream = fs.createReadStream(filePath).pipe(zlib.createGunzip());
  let carry = '';
  for await (const chunk of stream) {
    carry += chunk.toString('utf8');
    let idx;
    while ((idx = carry.indexOf('\n')) >= 0) {
      yield carry.slice(0, idx);
      carry = carry.slice(idx + 1);
    }
  }
  if (carry.length > 0) {
    yield carry;
  }
}

export async function* bz2Lines(filePath) {
  const queue = [];
  let notify = null;
  let finished = false;
  let error = null;

  const stream = fs.createReadStream(filePath).pipe(bz2());
  let carry = '';
  stream.on('data', (chunk) => {
    carry += chunk.toString('utf8');
    let idx;
    while ((idx = carry.indexOf('\n')) >= 0) {
      queue.push(carry.slice(0, idx));
      carry = carry.slice(idx + 1);
      if (notify) {
        const resolve = notify;
        notify = null;
        resolve();
      }
    }
  });
  stream.on('end', () => {
    if (carry.length > 0) {
      queue.push(carry);
    }
    finished = true;
    if (notify) {
      const resolve = notify;
      notify = null;
      resolve();
    }
  });
  stream.on('error', (err) => {
    error = err;
    if (notify) {
      const resolve = notify;
      notify = null;
      resolve();
    }
  });

  for (;;) {
    while (queue.length > 0) {
      yield queue.shift();
    }
    if (error) {
      throw error;
    }
    if (finished) {
      return;
    }
    await new Promise((resolve) => {
      notify = resolve;
    });
  }
}

export async function* tarBz2Lines(filePath, entryFilter) {
  const bzStream = fs.createReadStream(filePath).pipe(bz2());
  const queue = [];
  let notify = null;
  let finished = false;
  let error = null;

  const parser = bzStream.pipe(
    tarList({
      onentry: (entry) => {
        if (!entryFilter(entry.path)) {
          entry.resume();
          return;
        }
        let carry = '';
        entry.on('data', (chunk) => {
          carry += chunk.toString('utf8');
          let idx;
          while ((idx = carry.indexOf('\n')) >= 0) {
            queue.push(carry.slice(0, idx));
            carry = carry.slice(idx + 1);
            if (notify) {
              const resolve = notify;
              notify = null;
              resolve();
            }
          }
        });
        entry.on('end', () => {
          if (carry.length > 0) {
            queue.push(carry);
          }
        });
      },
    }),
  );

  parser.on('finish', () => {
    finished = true;
    if (notify) {
      const resolve = notify;
      notify = null;
      resolve();
    }
  });
  parser.on('error', (err) => {
    error = err;
    if (notify) {
      const resolve = notify;
      notify = null;
      resolve();
    }
  });

  for (;;) {
    while (queue.length > 0) {
      yield queue.shift();
    }
    if (error) {
      throw error;
    }
    if (finished) {
      return;
    }
    await new Promise((resolve) => {
      notify = resolve;
    });
  }
}

export function parseKunReading(rawReading) {
  const dotIndex = rawReading.indexOf('.');
  if (dotIndex === -1) {
    return { reading: rawReading, okurigana: undefined };
  }
  return { reading: rawReading.slice(0, dotIndex), okurigana: rawReading.slice(dotIndex + 1) };
}

export async function parseKanjidic(targetKanji) {
  const parser = kanjidicParser();
  const text = zlib.gunzipSync(await fs.promises.readFile(path.join(RAW_DIR, 'kanjidic2.xml.gz'))).toString('utf8');
  const doc = parser.parse(text);
  const characters = asArray(doc.kanjidic2.character);
  const targetSet = new Set(targetKanji);
  const records = {};
  for (const character of characters) {
    const literal = character.literal;
    if (!targetSet.has(literal)) {
      continue;
    }
    const misc = character.misc ?? {};
    const readings = [];
    const meaningsEn = [];
    const meaningsFr = [];
    for (const rmgroup of asArray(character.reading_meaning?.rmgroup)) {
      for (const reading of asArray(rmgroup.reading)) {
        const type = reading['@_r_type'];
        if (type === 'ja_on') {
          readings.push({ reading: String(reading['#text'] ?? reading), type: 'onyomi' });
        } else if (type === 'ja_kun') {
          const parsed = parseKunReading(String(reading['#text'] ?? reading));
          readings.push({ reading: parsed.reading, type: 'kunyomi', okurigana: parsed.okurigana });
        } else if (type === 'ja_nanori') {
          readings.push({ reading: String(reading['#text'] ?? reading), type: 'nanori' });
        }
      }
      for (const meaning of asArray(rmgroup.meaning)) {
        if (typeof meaning === 'string') {
          meaningsEn.push(meaning.trim());
        } else if (meaning && meaning['@_m_lang'] === 'fr' && meaning['#text'] !== undefined) {
          meaningsFr.push(String(meaning['#text']).trim());
        }
      }
    }
    const codepointHex = String(literal.codePointAt(0).toString(16)).toUpperCase().padStart(4, '0');
    const classicalRadical = asArray(character.radical?.rad_value).find((r) => r['@_rad_type'] === 'classical');
    records[literal] = {
      literal,
      unicodeCodepoint: `U+${codepointHex}`,
      strokeCount: Number(asArray(misc.stroke_count)[0] ?? 0),
      schoolGrade: misc.grade !== undefined ? Number(asArray(misc.grade)[0]) : undefined,
      frequencyRank: misc.freq !== undefined ? Number(asArray(misc.freq)[0]) : undefined,
      jlptLegacy: misc.jlpt !== undefined ? Number(asArray(misc.jlpt)[0]) : null,
      radicalClassical:
        classicalRadical !== undefined ? Number(classicalRadical['#text'] ?? classicalRadical) : null,
      readings,
      meaningsEn,
      meaningsFr,
    };
  }
  return records;
}

const XML_ENTITIES = {
  '&n;': 'nom',
  '&adv;': 'adverbe',
  '&int;': 'interjection',
  '&conj;': 'conjonction',
  '&prt;': 'particule',
  '&pref;': 'préfixe',
  '&suf;': 'suffixe',
  '&v1;': 'verbe (ichidan)',
  '&v5;': 'verbe (godan)',
  '&vs;': 'verbe (suru)',
  '&vk;': 'verbe (kuru)',
  '&adj-i;': 'adjectif (i)',
  '&adj-na;': 'adjectif (na)',
  '&adj-no;': 'adjectif (no)',
  '&exp;': 'expression',
  '&aux;': 'auxiliaire',
  '&cop;': 'copule',
  '&num;': 'numéral',
  '&pn;': 'pronom',
};

const JM_ARRAY_TAGS = ['k_ele', 'r_ele', 'sense', 'gloss', 'pos', 'ke_pri', 're_pri', 'ke_inf', 're_inf'];

export function parseJmdictEntry(fragment) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => JM_ARRAY_TAGS.includes(name),
  });
  const doc = parser.parse(fragment);
  const entry = doc.entry;
  if (!entry) {
    return null;
  }
  const kebList = asArray(entry.k_ele)
    .map((k) => String(k.keb ?? ''))
    .filter((k) => k.length > 0);
  if (kebList.length === 0) {
    return null;
  }
  const rebList = asArray(entry.r_ele).map((r) => String(r.reb ?? ''));
  const priorities = new Set();
  for (const k of asArray(entry.k_ele)) {
    for (const p of asArray(k.ke_pri)) {
      priorities.add(String(p));
    }
  }
  for (const r of asArray(entry.r_ele)) {
    for (const p of asArray(r.re_pri)) {
      priorities.add(String(p));
    }
  }
  const glossFr = [];
  const posLabels = [];
  for (const sense of asArray(entry.sense)) {
    for (const pos of asArray(sense.pos)) {
      const label = XML_ENTITIES[String(pos)];
      if (label && !posLabels.includes(label)) {
        posLabels.push(label);
      }
    }
    for (const gloss of asArray(sense.gloss)) {
      const lang = gloss['@_xml:lang'];
      if ((lang === 'fre' || lang === 'fra') && gloss['#text'] !== undefined) {
        const text = String(gloss['#text']).trim();
        if (text.length > 0 && !glossFr.includes(text)) {
          glossFr.push(text);
        }
      }
    }
  }
  if (glossFr.length === 0) {
    return null;
  }
  return {
    seq: String(entry.ent_seq ?? ''),
    keb: kebList,
    reb: rebList,
    priorities: [...priorities],
    pos: posLabels,
    glossFr,
  };
}

export async function streamJmdict(keepEntry) {
  const entries = [];
  const stream = fs.createReadStream(path.join(RAW_DIR, 'JMdict.gz')).pipe(zlib.createGunzip());
  let buffer = '';
  for await (const chunk of stream) {
    buffer += chunk.toString('utf8');
    let idx;
    while ((idx = buffer.indexOf('</entry>')) >= 0) {
      const fragment = buffer.slice(0, idx + 8);
      buffer = buffer.slice(idx + 8);
      if (!fragment.includes('<k_ele>')) {
        continue;
      }
      try {
        const entry = parseJmdictEntry(fragment);
        if (entry && keepEntry(entry)) {
          entries.push(entry);
        }
      } catch {
        continue;
      }
    }
  }
  return entries;
}

export async function listKanjivgSvgs() {
  const zipPath = path.join(RAW_DIR, 'kanjivg-main.zip');
  const codepoints = [];
  await new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipfile) => {
      if (openError) {
        reject(openError);
        return;
      }
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const match = /kanji\/([0-9a-f]{5})\.svg$/.exec(entry.fileName);
        if (match) {
          codepoints.push(match[1]);
        }
        zipfile.readEntry();
      });
      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });
  return codepoints;
}

export const IMPORT_LEVELS = [5, 4, 3];

const LEGACY_TO_NEW = { 4: 5, 3: 4 };

export async function runImport({ force = false } = {}) {
  const kanjiData = await readJson(path.join(RAW_DIR, 'kanji-data.json'));
  const kanjiApiCross = await readJson(path.join(RAW_DIR, 'kanjiapi-jlpt.json'));
  const kanjiApiLevels = {};
  for (const [literal, record] of Object.entries(kanjiApiCross)) {
    if (record.jlpt) {
      kanjiApiLevels[literal] = Number(record.jlpt);
    }
  }
  const kanjiDataLevels = {};
  for (const [literal, record] of Object.entries(kanjiData)) {
    if (record.jlpt_new) {
      kanjiDataLevels[literal] = Number(record.jlpt_new);
    }
  }

  const levelSets = {};
  const divergences = {};
  const targetKanji = new Set();
  for (const level of IMPORT_LEVELS) {
    const kanjiDataSet = new Set(Object.keys(kanjiData).filter((k) => kanjiData[k].jlpt_new === level));
    const kanjiApiSet = new Set(Object.keys(kanjiApiCross).filter((k) => kanjiApiCross[k].jlpt === level));
    levelSets[level] = kanjiDataSet;
    divergences[`N${level}`] = [...kanjiApiSet].filter((k) => !kanjiDataSet.has(k));
    for (const literal of kanjiDataSet) {
      targetKanji.add(literal);
    }
    console.log(
      `[import] N${level} kanji-data: ${kanjiDataSet.size}, N${level} kanjiapi (miroir): ${kanjiApiSet.size}`,
    );
  }

  let kanjidicRecords = await readJsonIfExists(path.join(IMPORTED_DIR, 'kanjidic.json'));
  if (force || !kanjidicRecords || [...targetKanji].some((k) => !kanjidicRecords[k])) {
    kanjidicRecords = await parseKanjidic([...targetKanji]);
    await writeJson(path.join(IMPORTED_DIR, 'kanjidic.json'), kanjidicRecords);
  } else {
    console.log('[import] kanjidic.json déjà présent (réutilisé)');
  }
  const legacyLiterals = Object.values(kanjidicRecords)
    .filter((r) => r.jlptLegacy !== null && LEGACY_TO_NEW[r.jlptLegacy] !== undefined)
    .map((r) => r.literal);

  const jlptCross = {};
  for (const literal of [...targetKanji, ...legacyLiterals]) {
    jlptCross[literal] = {
      kanjiDataLevel: kanjiDataLevels[literal] ?? null,
      kanjiApiLevel: kanjiApiLevels[literal] ?? null,
      kanjidicLegacyLevel: kanjidicRecords[literal]?.jlptLegacy ?? null,
    };
  }
  await writeJson(path.join(IMPORTED_DIR, 'jlpt_cross.json'), {
    divergences,
    kanji: jlptCross,
  });

  let kradMap = await readJsonIfExists(path.join(IMPORTED_DIR, 'krad.json'));
  if (force || !kradMap) {
    const kradRaw = await readJson(path.join(RAW_DIR, 'krad.json'));
    const componentsRaw = await readJson(path.join(RAW_DIR, 'krad_components.json'));
    kradMap = {};
    const usedComponents = new Set();
    for (const entry of kradRaw) {
      if (kanjidicRecords[entry.literal]) {
        kradMap[entry.literal] = entry.components;
        for (const component of entry.components) {
          usedComponents.add(component);
        }
      }
    }
    await writeJson(path.join(IMPORTED_DIR, 'krad.json'), kradMap);
    const componentStrokeCounts = Object.fromEntries(componentsRaw.map((c) => [c.component, c.strokeCount]));
    await writeJson(
      path.join(IMPORTED_DIR, 'components.json'),
      [...usedComponents].map((literal) => ({ literal, strokeCount: componentStrokeCounts[literal] ?? null })),
    );
  } else {
    console.log('[import] krad.json déjà présent (réutilisé)');
  }

  const targetSet = new Set(Object.keys(kanjidicRecords));

  let jmdictEntries = await readJsonIfExists(path.join(IMPORTED_DIR, 'jmdict.json'));
  if (force || !jmdictEntries) {
    jmdictEntries = await streamJmdict((entry) =>
      entry.keb.some((keb) => [...keb].some((ch) => targetSet.has(ch))),
    );
    console.log(`[import] JMdict: ${jmdictEntries.length} entrées avec glosses FR sur les kanji cibles`);
    await writeJson(path.join(IMPORTED_DIR, 'jmdict.json'), jmdictEntries);
  } else {
    console.log(`[import] jmdict.json déjà présent (${jmdictEntries.length} entrées, réutilisé)`);
  }

  await importTatoeba(targetSet, { force });

  let kanjivgIndex = await readJsonIfExists(path.join(IMPORTED_DIR, 'kanjivg-index.json'));
  if (force || !kanjivgIndex) {
    kanjivgIndex = await listKanjivgSvgs();
    await writeJson(path.join(IMPORTED_DIR, 'kanjivg-index.json'), kanjivgIndex);
  }
  console.log(`[import] KanjiVG: ${kanjivgIndex.length} SVG disponibles`);
}

async function importTatoeba(targetSet, { force = false } = {}) {
  const outPath = path.join(IMPORTED_DIR, 'tatoeba.json');
  if (!force) {
    const existing = await readJsonIfExists(outPath);
    if (existing && existing.length > 0) {
      console.log(`[import] tatoeba.json déjà présent (${existing.length} paires, réutilisé)`);
      return;
    }
  }
  const jpnPath = path.join(RAW_DIR, 'jpn_sentences_detailed.tsv.bz2');
  const fraPath = path.join(RAW_DIR, 'fra_sentences_detailed.tsv.bz2');
  const linksPath = path.join(RAW_DIR, 'links.tar.bz2');

  const jpnCandidates = new Map();
  const kanjiArray = [...targetSet];
  console.log('[import] Tatoeba: passe 1 (phrases japonaises)...');
  for await (const line of bz2Lines(jpnPath)) {
    const cols = line.split('\t');
    if (cols.length < 4 || cols[1] !== 'jpn') {
      continue;
    }
    const text = cols[2];
    if (text.length === 0 || text.length > 60) {
      continue;
    }
    if (!kanjiArray.some((k) => text.includes(k))) {
      continue;
    }
    const author = cols[3] && cols[3] !== '\\N' ? cols[3] : null;
    jpnCandidates.set(Number(cols[0]), { text, author });
  }
  console.log(`[import] Tatoeba: ${jpnCandidates.size} phrases japonaises candidates`);

  console.log('[import] Tatoeba: liens de traductions...');
  const linkedFra = new Map();
  for await (const line of tarBz2Lines(linksPath, (p) => p.endsWith('links.csv'))) {
    const cols = line.split('\t');
    if (cols.length < 2) {
      continue;
    }
    const a = Number(cols[0]);
    const b = Number(cols[1]);
    if (jpnCandidates.has(a)) {
      if (!linkedFra.has(a)) {
        linkedFra.set(a, []);
      }
      linkedFra.get(a).push(b);
    } else if (jpnCandidates.has(b)) {
      if (!linkedFra.has(b)) {
        linkedFra.set(b, []);
      }
      linkedFra.get(b).push(a);
    }
  }
  const neededFra = new Set();
  for (const ids of linkedFra.values()) {
    for (const id of ids) {
      neededFra.add(id);
    }
  }
  console.log(`[import] Tatoeba: ${linkedFra.size} phrases liées, ${neededFra.size} traductions potentielles`);

  console.log('[import] Tatoeba: passe 2 (traductions françaises)...');
  const fraTexts = new Map();
  for await (const line of bz2Lines(fraPath)) {
    const cols = line.split('\t');
    if (cols.length < 4 || cols[1] !== 'fra') {
      continue;
    }
    const id = Number(cols[0]);
    if (neededFra.has(id)) {
      fraTexts.set(id, cols[2]);
    }
  }

  const pairs = [];
  for (const [jpnId, fraIds] of linkedFra) {
    const jpn = jpnCandidates.get(jpnId);
    if (!jpn) {
      continue;
    }
    for (const fraId of fraIds) {
      const french = fraTexts.get(fraId);
      if (french && french.length > 0) {
        pairs.push({ jpnId, japanese: jpn.text, author: jpn.author, fraId, french });
      }
    }
  }
  console.log(`[import] Tatoeba: ${pairs.length} paires jpn→fra`);
  await writeJson(outPath, pairs);
}
