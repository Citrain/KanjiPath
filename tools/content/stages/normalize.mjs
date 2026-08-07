import path from 'node:path';
import fs from 'node:fs/promises';
import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { readJson, writeJson, writeText } from '../lib/fs-utils.mjs';
import { GENERATED_DIR, IMPORTED_DIR, CURATED_DIR, KANJIVG_DIR, NORMALIZED_DIR, RAW_DIR } from '../lib/paths.mjs';
import { SOURCES, SOURCE_ORDER } from '../sources.mjs';

export function cleanReading(reading) {
  return reading.replace(/^-+/, '').replace(/-+$/, '');
}

export function kanjiIdOf(literal) {
  return `k-${literal.codePointAt(0).toString(16).padStart(5, '0')}`;
}

export function vocabularyIdOf(seq) {
  return `v-${seq}`;
}

export function sentenceIdOf(jpnId) {
  return `s-tatoeba-${jpnId}`;
}

const KANA = /[ぁ-ん]/;

export function isKanaChar(ch) {
  return KANA.test(ch);
}

export function kanjiLiteralsOf(text) {
  return [...text].filter((ch) => !isKanaChar(ch) && /[\u3400-\u9fff\uf900-\ufaff]/.test(ch));
}

function alignWord(writtenForm, reading) {
  const segments = [];
  let current = '';
  let currentIsKana = null;
  for (const ch of writtenForm) {
    const kana = isKanaChar(ch);
    if (currentIsKana === null) {
      currentIsKana = kana;
    }
    if (kana !== currentIsKana) {
      segments.push({ text: current, kana: currentIsKana });
      current = ch;
      currentIsKana = kana;
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    segments.push({ text: current, kana: currentIsKana });
  }

  const partForSegment = new Array(segments.length).fill(null);
  let cursor = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.kana) {
      const idx = reading.indexOf(segment.text, cursor);
      if (idx === -1) {
        return null;
      }
      partForSegment[i] = segment.text;
      cursor = idx + segment.text.length;
      continue;
    }
    const nextKana = segments.slice(i + 1).find((s) => s.kana);
    const end = nextKana ? reading.indexOf(nextKana.text, cursor) : reading.length;
    if (end === -1 || end <= cursor) {
      return null;
    }
    partForSegment[i] = reading.slice(cursor, end);
    cursor = end;
  }

  const aligned = [];
  let writtenPosition = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.kana) {
      writtenPosition += [...segment.text].length;
      continue;
    }
    const kanjiCount = [...segment.text].length;
    const part = partForSegment[i];
    if (kanjiCount === 1) {
      aligned.push({ kanji: segment.text, position: writtenPosition, reading: part });
    } else if (kanjiCount === [...part].length) {
      [...segment.text].forEach((ch, j) => {
        aligned.push({ kanji: ch, position: writtenPosition + j, reading: [...part][j] });
      });
    } else {
      aligned.push({ kanji: segment.text, position: writtenPosition, reading: part });
    }
    writtenPosition += kanjiCount;
  }
  return aligned;
}

const PRIORITY_SCORES = {
  ichi1: 100,
  spec1: 90,
  news1: 80,
  ichi2: 60,
  spec2: 50,
  news2: 40,
};

function entryScore(entry, n5Set) {
  let score = 0;
  for (const priority of entry.priorities) {
    score += PRIORITY_SCORES[priority] ?? 0;
  }
  const keb = entry.keb[0];
  const kanji = kanjiLiteralsOf(keb);
  score -= keb.length * 2;
  for (const ch of kanji) {
    if (!n5Set.has(ch)) {
      score -= 150;
    }
  }
  if (kanji.length === 0) {
    score -= 500;
  }
  return score;
}

function hasOnlyKanjiKana(text) {
  return [...text].every((ch) => isKanaChar(ch) || /[\u3400-\u9fff\uf900-\ufaff]/.test(ch));
}

export async function selectVocabulary(jmdictEntries, n5Set, kanjiOrder) {
  const candidates = jmdictEntries
    .filter((entry) => entry.keb.some((keb) => [...keb].some((ch) => n5Set.has(ch))))
    .filter((entry) => hasOnlyKanjiKana(entry.keb[0]))
    .map((entry) => ({ entry, score: entryScore(entry, n5Set) }))
    .sort((a, b) => b.score - a.score || a.entry.keb[0].length - b.entry.keb[0].length || Number(a.entry.seq) - Number(b.entry.seq));

  const perKanji = new Map([...n5Set].map((k) => [k, []]));
  const selected = [];
  const seen = new Set();

  for (const { entry } of candidates) {
    const keb = entry.keb[0];
    const reb = entry.reb[0];
    if (!reb) {
      continue;
    }
    const key = `${keb}|${reb}`;
    if (seen.has(key)) {
      continue;
    }
    const kanjiInWord = [...keb].filter((ch) => n5Set.has(ch));
    if (kanjiInWord.length === 0) {
      continue;
    }
    const needs = kanjiInWord.filter((k) => perKanji.get(k).length < 8);
    if (needs.length === 0) {
      continue;
    }
    seen.add(key);
    selected.push({ entry, keb, reb });
    for (const k of kanjiInWord) {
      perKanji.get(k).push(key);
    }
  }

  return { selected, perKanji };
}

const SANITIZE_ALLOWED_TAGS = new Set(['svg', 'g', 'path']);
const SANITIZE_ALLOWED_ATTRS = {
  svg: ['xmlns', 'viewBox', 'width', 'height'],
  g: ['id', 'class', 'transform', 'kvg:element', 'kvg:original', 'kvg:part', 'kvmisc'],
  path: ['id', 'class', 'd'],
};

function sanitizeSvgNode(node, tag) {
  if (node === null || typeof node !== 'object') {
    return null;
  }
  const allowed = SANITIZE_ALLOWED_ATTRS[tag] ?? [];
  const out = {};
  for (const attr of allowed) {
    const value = node[`@_${attr}`];
    if (value !== undefined) {
      out[`@_${attr}`] = value;
    }
  }
  return out;
}

export function sanitizeKanjiSvg(svgText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'g' || name === 'path',
  });
  const doc = parser.parse(svgText);
  const svg = doc.svg;
  if (!svg) {
    throw new Error('SVG invalide (pas de balise svg)');
  }

  const serializeAttrs = (obj) =>
    Object.entries(obj)
      .filter(([k]) => k.startsWith('@_'))
      .map(([k, v]) => `${k.slice(2)}="${String(v).replace(/"/g, '&quot;')}"`)
      .join(' ');

  const lines = [];
  lines.push(`<svg ${serializeAttrs(sanitizeSvgNode(svg, 'svg'))}>`);
  const walk = (node) => {
    for (const g of node.g ?? []) {
      lines.push(`<g ${serializeAttrs(sanitizeSvgNode(g, 'g'))}>`);
      for (const p of g.path ?? []) {
        lines.push(`<path ${serializeAttrs(sanitizeSvgNode(p, 'path'))}/>`);
      }
      walk(g);
      lines.push('</g>');
    }
  };
  walk(svg);
  lines.push('</svg>');
  return lines.join('');
}

export async function extractKanjivg(literals) {
  const zipPath = path.join(RAW_DIR, 'kanjivg-main.zip');
  const wanted = new Map([...literals].map((literal) => [`${literal.codePointAt(0).toString(16).padStart(5, '0')}.svg`, literal]));
  const written = [];
  await new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipfile) => {
      if (openError) {
        reject(openError);
        return;
      }
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const base = path.posix.basename(entry.fileName);
        if (/kanji\//.test(entry.fileName) && wanted.has(base)) {
          zipfile.openReadStream(entry, (streamError, stream) => {
            if (streamError) {
              reject(streamError);
              return;
            }
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
              const svgText = Buffer.concat(chunks).toString('utf8');
              const sanitized = sanitizeKanjiSvg(svgText);
              const literal = wanted.get(base);
              const dest = path.join(KANJIVG_DIR, `${base}`);
              fs.mkdir(KANJIVG_DIR, { recursive: true })
                .then(() => writeText(dest, `${sanitized}\n`))
                .then(() => {
                  written.push(literal);
                  zipfile.readEntry();
                })
                .catch(reject);
            });
            stream.on('error', reject);
          });
          return;
        }
        zipfile.readEntry();
      });
      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });
  return written;
}

export async function stageNormalize() {
  const curatedKanji = await readJson(path.join(CURATED_DIR, 'n5', 'kanji.json'));
  const curatedSentences = await readJson(path.join(CURATED_DIR, 'n5', 'sentences.json'));
  const curatedVocabulary = await readJson(path.join(CURATED_DIR, 'n5', 'vocabulary.json'));
  const componentsFr = await readJson(path.join(CURATED_DIR, 'components-fr.json'));
  const kanjidic = await readJson(path.join(IMPORTED_DIR, 'kanjidic.json'));
  const krad = await readJson(path.join(IMPORTED_DIR, 'krad.json'));
  const jmdict = await readJson(path.join(IMPORTED_DIR, 'jmdict.json'));
  const tatoeba = await readJson(path.join(IMPORTED_DIR, 'tatoeba.json'));
  const kanjivgIndex = await readJson(path.join(IMPORTED_DIR, 'kanjivg-index.json'));
  const downloadReport = await readJson(path.join(NORMALIZED_DIR, '..', 'reports', 'download.json')).catch(() => null);

  const n5Kanji = curatedKanji.kanji;
  const n5Set = new Set(n5Kanji.map((k) => k.literal));
  const kanjivgSet = new Set(kanjivgIndex);

  const kanjiOut = [];
  for (const curated of n5Kanji) {
    const dic = kanjidic[curated.literal];
    if (!dic) {
      throw new Error(`Kanji ${curated.literal} absent de KANJIDIC2`);
    }
    const meaningsFr = dic.meaningsFr.filter((m) => !/^radical/i.test(m));
    if (meaningsFr.length === 0) {
      throw new Error(`Kanji ${curated.literal} sans sens français`);
    }
    const cp5 = curated.literal.codePointAt(0).toString(16).padStart(5, '0');
    kanjiOut.push({
      id: kanjiIdOf(curated.literal),
      literal: curated.literal,
      unicodeCodepoint: `U+${cp5.toUpperCase()}`,
      strokeCount: dic.strokeCount,
      frequencyRank: dic.frequencyRank,
      schoolGrade: dic.schoolGrade,
      meanings: meaningsFr.map((meaning, i) => ({ language: 'fr', meaning, isPrimary: i === 0 })),
      readings: (() => {
        const seen = new Set();
        const out = [];
        for (const r of dic.readings) {
          const reading = cleanReading(r.reading);
          if (reading.length === 0) {
            continue;
          }
          const key = `${r.type}:${reading}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          out.push({
            reading,
            type: r.type,
            okurigana: r.okurigana,
            commonness: r.type === 'nanori' ? 'rare' : 'common',
          });
        }
        return out;
      })(),
      radical: curated.radical,
      components: (krad[curated.literal] ?? []).map((literal, position) => ({
        literal,
        nameFr: componentsFr[literal]?.nameFr,
        meaningFr: componentsFr[literal]?.meaningFr,
        role: curated.componentRoles?.[literal] ?? 'unknown',
        position,
      })),
      confusions: curated.confusions ?? [],
      mnemonicFr: curated.mnemonicFr,
      etymologyFr: curated.etymologyFr,
      etymologySource: curated.etymologySource,
      level: 'N5',
      order: curated.order,
      kanjivgPath: kanjivgSet.has(cp5) ? `kanjivg/${cp5}.svg` : undefined,
      sourceId: 'kanjidic2',
      editorialStatus: 'reviewed',
    });
  }

  const kanjiOrder = n5Kanji.map((k) => k.literal);
  const { selected, perKanji } = await selectVocabulary(jmdict, n5Set, kanjiOrder);

  const vocabularyOut = [];
  for (const { entry, keb, reb } of selected) {
    const aligned = alignWord(keb, reb);
    const kanjiPositions = [...keb]
      .map((ch, position) => ({ ch, position }))
      .filter(({ ch }) => n5Set.has(ch));
    vocabularyOut.push({
      id: vocabularyIdOf(entry.seq),
      externalId: `jmdict-${entry.seq}`,
      writtenForm: keb,
      reading: reb,
      meaningFr: entry.glossFr.slice(0, 3).join(' ; '),
      partOfSpeech: entry.pos[0],
      frequencyRank: undefined,
      estimatedLevel: [...kanjiLiteralsOf(keb)].every((ch) => n5Set.has(ch)) ? 'N5' : 'N4',
      kanji: kanjiPositions.map(({ ch, position }) => {
        const alignedEntry = aligned?.find((a) => a.position === position && a.kanji === ch);
        return {
          kanjiId: kanjiIdOf(ch),
          position,
          readingInWord: alignedEntry?.reading,
        };
      }),
      sourceId: 'jmdict',
      editorialStatus: 'reviewed',
    });
  }

  for (const curatedWord of curatedVocabulary.vocabulary ?? []) {
    vocabularyOut.push({
      id: `v-curated-${vocabularyOut.length}`,
      writtenForm: curatedWord.writtenForm,
      reading: curatedWord.reading,
      meaningFr: curatedWord.meaningFr,
      partOfSpeech: curatedWord.partOfSpeech,
      estimatedLevel: curatedWord.estimatedLevel ?? 'N5',
      kanji: curatedWord.kanji.map((k) => ({
        kanjiId: kanjiIdOf(k.literal),
        position: k.position,
        readingInWord: k.readingInWord,
      })),
      sourceId: 'kanjipath_editorial',
      editorialStatus: 'reviewed',
    });
    for (const k of curatedWord.kanji) {
      if (n5Set.has(k.literal)) {
        perKanji.get(k.literal).push(`${curatedWord.writtenForm}|${curatedWord.reading}`);
      }
    }
  }

  const sentencesOut = [];
  const sentenceCountByKanji = new Map([...n5Set].map((k) => [k, 0]));
  const sortedPairs = [...tatoeba].sort((a, b) => a.japanese.length - b.japanese.length || a.jpnId - b.jpnId);
  for (const pair of sortedPairs) {
    const kanjiInSentence = [...n5Set].filter((k) => pair.japanese.includes(k));
    if (kanjiInSentence.length === 0) {
      continue;
    }
    const starving = kanjiInSentence.filter((k) => sentenceCountByKanji.get(k) < 6);
    if (starving.length === 0) {
      continue;
    }
    if (sentencesOut.some((s) => s.japanese === pair.japanese)) {
      continue;
    }
    sentencesOut.push({
      id: sentenceIdOf(pair.jpnId),
      japanese: pair.japanese,
      translationFr: pair.french,
      difficulty: 'N5',
      targetKanjiIds: kanjiInSentence.map(kanjiIdOf),
      tokens: [],
      sourceId: 'tatoeba',
      externalId: `tatoeba-${pair.jpnId}`,
      author: pair.author ?? 'Tatoeba',
      license: 'CC BY 2.0 FR',
      editorialStatus: 'reviewed',
    });
    for (const k of kanjiInSentence) {
      sentenceCountByKanji.set(k, sentenceCountByKanji.get(k) + 1);
    }
  }

  for (const curatedSentence of curatedSentences.sentences ?? []) {
    const kanjiInSentence = [...n5Set].filter((k) => curatedSentence.japanese.includes(k));
    sentencesOut.push({
      id: `s-curated-${sentencesOut.length}`,
      japanese: curatedSentence.japanese,
      translationFr: curatedSentence.french,
      difficulty: 'N5',
      targetKanjiIds: kanjiInSentence.map(kanjiIdOf),
      tokens: [],
      sourceId: 'kanjipath_editorial',
      license: 'CC BY-SA 4.0',
      author: 'KanjiPath',
      editorialStatus: 'reviewed',
    });
  }

  const curriculum = {
    code: 'JLPT_ALIGNED',
    name: 'Parcours aligné sur le JLPT',
    version: '2026.08.1',
    status: 'published',
    notes: curatedKanji.notes,
    levels: {
      N5: n5Kanji.map((k) => ({
        kanjiId: kanjiIdOf(k.literal),
        literal: k.literal,
        order: k.order,
        confidence: 'high',
        sourceNames: ['kanji-data (MIT)', 'kanjiapi.dev (miroir)', 'KANJIDIC2 jlpt historique'],
      })),
    },
  };

  const sources = SOURCE_ORDER.map((id) => {
    const source = SOURCES[id];
    const files = (downloadReport?.files ?? []).filter((f) => f.sourceId === id);
    return {
      id: source.id,
      name: source.name,
      url: source.url,
      license: source.license,
      attributionText: source.attributionText,
      sourceVersion: files[0]?.version ?? null,
      checksums: files.map((f) => ({ file: f.file, sha256: f.sha256 })),
    };
  });

  await writeJson(path.join(NORMALIZED_DIR, 'kanji.json'), kanjiOut);
  await writeJson(path.join(NORMALIZED_DIR, 'vocabulary.json'), vocabularyOut);
  await writeJson(path.join(NORMALIZED_DIR, 'sentences.json'), sentencesOut);
  await writeJson(path.join(NORMALIZED_DIR, 'curriculum.json'), curriculum);
  await writeJson(path.join(NORMALIZED_DIR, 'sources.json'), sources);

  const extracted = await extractKanjivg([...n5Set]);
  console.log(`[normalize] KanjiVG: ${extracted.length} SVG extraits et assainis`);

  const missingVocab = kanjiOrder.filter((k) => perKanji.get(k).length < 6);
  const missingSentences = kanjiOrder.filter((k) => sentenceCountByKanji.get(k) < 6);
  console.log(`[normalize] vocabulaire: ${vocabularyOut.length} mots; kanji < 6 mots: ${missingVocab.join('') || 'aucun'}`);
  console.log(`[normalize] phrases: ${sentencesOut.length}; kanji < 6 phrases: ${missingSentences.join('') || 'aucun'}`);
}
