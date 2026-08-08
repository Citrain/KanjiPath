import fs from 'node:fs';
import path from 'node:path';
import { CURATED_DIR, IMPORTED_DIR, NORMALIZED_DIR, RAW_DIR } from './lib/paths.mjs';
import { writeJson } from './lib/fs-utils.mjs';

const LEVEL_DIRS = ['n5', 'n4', 'n3', 'n2'];
const MIN_WORDS = 5;
const MIN_SENTENCES = 5;

async function readJson(filePath) {
  return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
}

async function main() {
  const kanjiData = await readJson(path.join(RAW_DIR, 'kanji-data.json'));
  const kanjidic = await readJson(path.join(IMPORTED_DIR, 'kanjidic.json'));

  const numberToLiteral = {};
  const radicalNames = {};
  for (const dir of LEVEL_DIRS) {
    const curated = await readJson(path.join(CURATED_DIR, dir, 'kanji.json'));
    for (const k of curated.kanji) {
      if (!k.radical) {
        continue;
      }
      if (radicalNames[k.radical.literal] === undefined) {
        radicalNames[k.radical.literal] = { nameFr: k.radical.nameFr, meaningFr: k.radical.meaningFr };
      }
      const num = kanjidic[k.literal]?.radicalClassical;
      if (num && numberToLiteral[num] === undefined) {
        numberToLiteral[num] = k.radical.literal;
      }
    }
  }

  const radicalsFrPath = path.join(CURATED_DIR, 'radicals-fr.json');
  const radicalsFr = fs.existsSync(radicalsFrPath) ? await readJson(radicalsFrPath) : {};
  for (const [num, entry] of Object.entries(radicalsFr)) {
    if (numberToLiteral[num] === undefined) {
      numberToLiteral[num] = entry.literal;
    }
    if (radicalNames[entry.literal] === undefined) {
      radicalNames[entry.literal] = { nameFr: entry.nameFr, meaningFr: entry.meaningFr };
    }
  }

  const confusionsPath = path.join(CURATED_DIR, 'confusions-fr.json');
  const confusionPairs = fs.existsSync(confusionsPath) ? (await readJson(confusionsPath)).pairs : [];

  const meaningsFrPath = path.join(CURATED_DIR, 'n1', 'meanings-fr.json');
  const meaningsFr = fs.existsSync(meaningsFrPath) ? await readJson(meaningsFrPath) : {};

  const mnemonicsDir = path.join(CURATED_DIR, 'n1', 'mnemonics');
  const mnemonics = {};
  if (fs.existsSync(mnemonicsDir)) {
    for (const file of fs.readdirSync(mnemonicsDir).filter((f) => f.endsWith('.json')).sort()) {
      Object.assign(mnemonics, await readJson(path.join(mnemonicsDir, file)));
    }
  }

  const allLiterals = new Set();
  for (const dir of LEVEL_DIRS) {
    const curated = await readJson(path.join(CURATED_DIR, dir, 'kanji.json'));
    for (const k of curated.kanji) {
      allLiterals.add(k.literal);
    }
  }
  const n1 = Object.keys(kanjiData).filter((literal) => kanjiData[literal].jlpt_new === 1);
  for (const literal of n1) {
    allLiterals.add(literal);
  }

  const adjacency = new Map();
  for (const [a, b] of confusionPairs) {
    if (!allLiterals.has(a) || !allLiterals.has(b) || a === b) {
      continue;
    }
    if (!adjacency.has(a)) {
      adjacency.set(a, new Set());
    }
    if (!adjacency.has(b)) {
      adjacency.set(b, new Set());
    }
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }

  const ordered = n1
    .map((literal) => ({
      literal,
      strokeCount: kanjidic[literal].strokeCount,
      frequencyRank: kanjidic[literal].frequencyRank ?? Number.MAX_SAFE_INTEGER,
      radicalClassical: kanjidic[literal].radicalClassical,
    }))
    .sort(
      (a, b) =>
        a.strokeCount - b.strokeCount ||
        a.frequencyRank - b.frequencyRank ||
        a.literal.codePointAt(0) - b.literal.codePointAt(0),
    );

  const coverage = { words: new Map(), sentences: new Map() };
  let coverageAvailable = false;
  if (!process.argv.includes('--all')) {
    try {
      const normKanji = JSON.parse(await fs.promises.readFile(path.join(NORMALIZED_DIR, 'kanji.json'), 'utf8'));
      const normVocab = JSON.parse(await fs.promises.readFile(path.join(NORMALIZED_DIR, 'vocabulary.json'), 'utf8'));
      const normSentences = JSON.parse(await fs.promises.readFile(path.join(NORMALIZED_DIR, 'sentences.json'), 'utf8'));
      const byLiteral = new Map(normKanji.map((k) => [k.id, k.literal]));
      const wordCount = new Map(normKanji.map((k) => [k.literal, 0]));
      const sentenceCount = new Map(normKanji.map((k) => [k.literal, 0]));
      for (const v of normVocab) {
        for (const link of v.kanji) {
          const literal = byLiteral.get(link.kanjiId);
          if (literal && wordCount.has(literal)) {
            wordCount.set(literal, wordCount.get(literal) + 1);
          }
        }
      }
      for (const s of normSentences) {
        for (const id of s.targetKanjiIds) {
          const literal = byLiteral.get(id);
          if (literal && sentenceCount.has(literal)) {
            sentenceCount.set(literal, sentenceCount.get(literal) + 1);
          }
        }
      }
      coverage.words = wordCount;
      coverage.sentences = sentenceCount;
      coverageAvailable = true;
    } catch {
      coverageAvailable = false;
    }
  }

  const publishable = coverageAvailable
    ? ordered.filter(
        (entry) =>
          (coverage.words.get(entry.literal) ?? 0) >= MIN_WORDS &&
          (coverage.sentences.get(entry.literal) ?? 0) >= MIN_SENTENCES,
      )
    : ordered;
  const pending = ordered.filter((entry) => !publishable.includes(entry));

  const kanji = [];
  const missingRadicalNames = [];
  const withoutMnemonic = [];
  const withoutConfusion = [];
  publishable.forEach((entry, index) => {
    const literal = entry.radicalClassical ? numberToLiteral[entry.radicalClassical] : undefined;
    if (!literal) {
      throw new Error(`Radical classique inconnu pour ${entry.literal} (n° ${entry.radicalClassical})`);
    }
    const name = radicalNames[literal];
    if (!name?.nameFr) {
      missingRadicalNames.push(`${entry.literal}:${literal}`);
    }
    const confusions = [...(adjacency.get(entry.literal) ?? [])].sort();
    if (confusions.length === 0) {
      withoutConfusion.push(entry.literal);
    }
    const mnemonicFr = mnemonics[entry.literal];
    if (!mnemonicFr) {
      withoutMnemonic.push(entry.literal);
    }
    kanji.push({
      literal: entry.literal,
      order: index + 1,
      radical: { literal, nameFr: name?.nameFr ?? null, meaningFr: name?.meaningFr ?? null },
      confusions,
      ...(meaningsFr[entry.literal] ? { meaningsFr: meaningsFr[entry.literal] } : {}),
      ...(mnemonicFr ? { mnemonicFr } : {}),
    });
  });

  const outDir = path.join(CURATED_DIR, 'n1');
  fs.mkdirSync(outDir, { recursive: true });
  await writeJson(path.join(outDir, 'kanji.json'), {
    level: 'N1',
    curriculum: 'JLPT_ALIGNED',
    notes:
      'Liste croisée : kanji-data (MIT, jlpt_new=1) et miroir kanjiapi.dev (jlpt=1) — 1232 kanji identiques, 0 divergence. ' +
      (coverageAvailable
        ? `Publication progressive : seuls les ${publishable.length} kanji couverts par au moins ${MIN_WORDS} mots JMdict FR et ${MIN_SENTENCES} phrases Tatoeba FR sont dans ce pack ; les ${pending.length} autres sont dans kanji-pending.json et seront ajoutés par curation (voir docs/agent/suivi-phase-4b.md). `
        : '') +
      'Ordre : nombre de traits croissant, puis rang de fréquence croissant (ordre de type dictionnaire, adapté à un niveau avancé). ' +
      'Radicaux : numéro classique KANJIDIC2, convention de littéral reprise des niveaux N5-N2 (table tools/content/n1-scaffold.mjs). ' +
      'Sens français manquants dans KANJIDIC2 complétés par curation (content/curated/n1/meanings-fr.json). ' +
      'Confusions : paires curatées (content/curated/confusions-fr.json), appliquées aux deux membres quand les deux kanji sont au référentiel.',
    kanji,
  });
  await writeJson(path.join(outDir, 'kanji-pending.json'), {
    level: 'N1',
    notes:
      `Kanji N1 non encore publiés (couverture insuffisante : < ${MIN_WORDS} mots ou < ${MIN_SENTENCES} phrases). ` +
      'Pour les publier : curater vocabulaire (vocabulary.json) et phrases (sentences.json) jusqu\'à couverture, ' +
      'puis relancer normalize + n1-scaffold + validate. Radicaux et confusions sont recalculés automatiquement par le squelette ; ' +
      'les mnémotechniques déjà écrites sont conservées ci-dessous.',
    kanji: pending.map((entry) => ({
      literal: entry.literal,
      words: coverage.words.get(entry.literal) ?? 0,
      sentences: coverage.sentences.get(entry.literal) ?? 0,
      mnemonicFr: mnemonics[entry.literal] ?? null,
    })),
  });

  const stubIfMissing = async (file, content) => {
    const filePath = path.join(outDir, file);
    if (!fs.existsSync(filePath)) {
      await writeJson(filePath, content);
    }
  };
  await stubIfMissing('sentences.json', {
    level: 'N1',
    notes: 'Phrases naturelles rédigées par KanjiPath, prioritaires sur la sélection Tatoeba dans les exercices. Schéma : { japanese, french }.',
    sentences: [],
  });
  await stubIfMissing('vocabulary.json', {
    level: 'N1',
    notes: 'Vocabulaire créé manuellement pour compléter la sélection JMdict (kanji N1 peu couverts par les glosses françaises).',
    vocabulary: [],
  });
  await stubIfMissing('texts.json', {
    level: 'N1',
    notes: 'Textes de lecture graduée : kanji de niveau N1 ou inférieur uniquement, mots non couverts en kana.',
    texts: [],
  });

  console.log(`[n1-scaffold] ${kanji.length} kanji curatés (squelette)`);
  console.log(`[n1-scaffold] mnémotechniques manquantes: ${withoutMnemonic.length}`);
  if (withoutMnemonic.length > 0 && withoutMnemonic.length <= 200) {
    console.log(`[n1-scaffold] sans mnémotechnique: ${withoutMnemonic.join('')}`);
  }
  console.log(`[n1-scaffold] sans confusion: ${withoutConfusion.length}`);
  console.log(`[n1-scaffold] noms de radical manquants: ${missingRadicalNames.join(' ') || 'aucun'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
