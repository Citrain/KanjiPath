import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson } from '../lib/fs-utils.mjs';
import { GENERATED_DIR, KANJIVG_DIR, NORMALIZED_DIR, REPORTS_DIR } from '../lib/paths.mjs';

const KANA_RE = /^[ぁ-ゖー]+$/;
const KATAKANA_RE = /^[ァ-ヺー]+$/;

const TEMPLATE_CATEGORY = {
  kanji_to_meaning_qcm: 'meaning',
  meaning_to_kanji_qcm: 'meaning',
  kanji_to_reading_qcm: 'reading',
  reading_input_kana: 'reading',
  reading_type_qcm: 'reading',
  vocab_reading_qcm: 'vocabulary',
  vocab_meaning_qcm: 'vocabulary',
  vocab_reading_advanced_qcm: 'reading',
  sentence_cloze_kanji: 'context',
  sentence_cloze_reading: 'context',
  sentence_translation_qcm: 'context',
  radical_recognition_qcm: 'stroke',
  stroke_count_qcm: 'stroke',
  component_selection_qcm: 'stroke',
  component_search_qcm: 'stroke',
  confusion_pair_qcm: 'confusion',
};

const LEVEL_MINIMUMS = {
  N5: { exercises: 40, sentences: 6, words: 6, texts: 2, total: 3000 },
  N4: { exercises: 32, sentences: 5, words: 5, texts: 2, total: 5000 },
  N3: { exercises: 32, sentences: 5, words: 5, texts: 2, total: 10000 },
  N2: { exercises: 32, sentences: 5, words: 5, texts: 2, total: 10000 },
};
const CATEGORY_SHARES = {
  meaning: 0.2,
  reading: 0.2,
  vocabulary: 0.2,
  context: 0.2,
  stroke: 0.1,
  confusion: 0.1,
};
const SHARE_TOLERANCE = 0.06;

function norm(text) {
  return String(text).normalize('NFC').trim().toLowerCase();
}

export async function stageValidate() {
  const [kanji, vocabulary, sentences, texts, curriculum, sources, exercises] = await Promise.all([
    readJson(path.join(NORMALIZED_DIR, 'kanji.json')),
    readJson(path.join(NORMALIZED_DIR, 'vocabulary.json')),
    readJson(path.join(NORMALIZED_DIR, 'sentences.json')),
    readJson(path.join(NORMALIZED_DIR, 'texts.json')),
    readJson(path.join(NORMALIZED_DIR, 'curriculum.json')),
    readJson(path.join(NORMALIZED_DIR, 'sources.json')),
    readJson(path.join(GENERATED_DIR, 'exercises.json')),
  ]);

  const errors = [];
  const warnings = [];

  const kanjiIds = new Set(kanji.map((k) => k.id));
  const vocabIds = new Set(vocabulary.map((v) => v.id));
  const sentenceIds = new Set(sentences.map((s) => s.id));

  const ids = new Set();
  for (const list of [kanji, vocabulary, sentences, texts, exercises]) {
    for (const item of list) {
      if (ids.has(item.id)) {
        errors.push(`Identifiant dupliqué: ${item.id}`);
      }
      ids.add(item.id);
    }
  }

  for (const k of kanji) {
    if (!k.level) {
      errors.push(`Kanji ${k.literal} sans niveau`);
    }
    if (!k.meanings.some((m) => m.language === 'fr')) {
      errors.push(`Kanji ${k.literal} sans sens français`);
    }
    if (k.editorialStatus === 'draft') {
      errors.push(`Kanji ${k.literal} en état draft dans le pack`);
    }
    if ((k.confusions ?? []).includes(k.literal)) {
      errors.push(`Kanji ${k.literal} listé dans ses propres confusions`);
    }
    for (const reading of k.readings) {
      if (reading.type === 'onyomi' && !KATAKANA_RE.test(reading.reading)) {
        errors.push(`Lecture on invalide pour ${k.literal}: ${reading.reading}`);
      }
      if (reading.type === 'kunyomi' && !KANA_RE.test(reading.reading)) {
        errors.push(`Lecture kun invalide pour ${k.literal}: ${reading.reading}`);
      }
      if (!reading.romaji) {
        errors.push(`Lecture ${reading.reading} de ${k.literal} sans romaji`);
      }
    }
    if (k.kanjivgPath) {
      const svgPath = path.join(GENERATED_DIR, k.kanjivgPath);
      await fs.access(svgPath).catch(() => {
        errors.push(`SVG manquant pour ${k.literal}: ${k.kanjivgPath}`);
      });
    } else {
      warnings.push(`Kanji ${k.literal} sans SVG KanjiVG`);
    }
  }

  for (const sentence of sentences) {
    if (!sentence.targetKanjiIds.some((id) => kanjiIds.has(id))) {
      errors.push(`Phrase ${sentence.id} sans kanji cible du référentiel`);
    }
    for (const id of sentence.targetKanjiIds) {
      const k = kanji.find((x) => x.id === id);
      if (k && !sentence.japanese.includes(k.literal)) {
        errors.push(`Phrase ${sentence.id} déclarée pour ${k.literal} mais ne le contient pas`);
      }
    }
    if (!sentence.license) {
      errors.push(`Phrase ${sentence.id} sans licence`);
    }
    if (sentence.license?.startsWith('CC BY') && !sentence.author) {
      errors.push(`Phrase ${sentence.id} sous ${sentence.license} sans attribution`);
    }
    if (sentence.editorialStatus === 'draft') {
      errors.push(`Phrase ${sentence.id} en état draft dans le pack`);
    }
    if (!Array.isArray(sentence.tokens) || sentence.tokens.length === 0) {
      errors.push(`Phrase ${sentence.id} sans tokens annotés`);
    } else {
      const reassembled = sentence.tokens.map((token) => token.surface).join('');
      if (reassembled !== sentence.japanese) {
        errors.push(`Phrase ${sentence.id}: tokens ne couvrent pas la phrase`);
      }
      for (const token of sentence.tokens) {
        if (/[\u3400-\u9fff\uf900-\ufaff]/.test(token.surface) && (!token.reading || !token.romaji)) {
          errors.push(`Phrase ${sentence.id}: token ${token.surface} sans lecture/romaji`);
        }
      }
    }
  }

  for (const vocab of vocabulary) {
    if (!vocab.meaningFr) {
      errors.push(`Vocabulaire ${vocab.id} sans traduction française`);
    }
    if (!vocab.romaji) {
      errors.push(`Vocabulaire ${vocab.id} sans romaji`);
    }
    for (const link of vocab.kanji) {
      if (!kanjiIds.has(link.kanjiId)) {
        errors.push(`Vocabulaire ${vocab.id} référence un kanji inexistant: ${link.kanjiId}`);
      }
    }
    if (vocab.editorialStatus === 'draft') {
      errors.push(`Vocabulaire ${vocab.id} en état draft dans le pack`);
    }
  }

  const LEVEL_RANK = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
  const kanjiLevelByLiteral = new Map(kanji.map((k) => [k.literal, k.level]));
  const textsByLevel = {};
  for (const text of texts) {
    textsByLevel[text.level] = (textsByLevel[text.level] ?? 0) + 1;
    if (!text.title || !text.body || !text.translationFr) {
      errors.push(`Mini-texte ${text.id} incomplet (titre, corps ou traduction manquant)`);
    }
    if (LEVEL_RANK[text.level] === undefined) {
      errors.push(`Mini-texte ${text.id} avec niveau invalide: ${text.level}`);
    }
    if (!text.license) {
      errors.push(`Mini-texte ${text.id} sans licence`);
    }
    if (text.license?.startsWith('CC BY') && !text.author) {
      errors.push(`Mini-texte ${text.id} sous ${text.license} sans attribution`);
    }
    if (text.editorialStatus === 'draft') {
      errors.push(`Mini-texte ${text.id} en état draft dans le pack`);
    }
    for (const ch of [...text.body]) {
      if (!/[\u3400-\u9fff\uf900-\ufaff]/.test(ch)) {
        continue;
      }
      const kanjiLevel = kanjiLevelByLiteral.get(ch);
      if (kanjiLevel === undefined) {
        errors.push(`Mini-texte ${text.id}: kanji hors référentiel (${ch})`);
      } else if (LEVEL_RANK[kanjiLevel] > LEVEL_RANK[text.level]) {
        errors.push(`Mini-texte ${text.id} (${text.level}): kanji ${ch} de niveau supérieur (${kanjiLevel})`);
      }
    }
    if (!Array.isArray(text.tokens) || text.tokens.length === 0) {
      errors.push(`Mini-texte ${text.id} sans tokens annotés`);
    } else {
      const reassembled = text.tokens.map((token) => token.surface).join('');
      if (reassembled !== text.body) {
        errors.push(`Mini-texte ${text.id}: tokens ne couvrent pas le texte`);
      }
      for (const token of text.tokens) {
        if (/[\u3400-\u9fff\uf900-\ufaff]/.test(token.surface) && (!token.reading || !token.romaji)) {
          errors.push(`Mini-texte ${text.id}: token ${token.surface} sans lecture/romaji`);
        }
      }
    }
  }
  for (const [level, minimums] of Object.entries(LEVEL_MINIMUMS)) {
    const count = textsByLevel[level] ?? 0;
    if (count < minimums.texts) {
      errors.push(`Mini-textes ${level} insuffisants: ${count} (< ${minimums.texts})`);
    }
  }

  for (const source of sources) {
    if (!source.license) {
      errors.push(`Source ${source.id} sans licence`);
    }
  }

  const countByKanji = new Map(kanji.map((k) => [k.id, 0]));
  const wordsByKanji = new Map(kanji.map((k) => [k.id, 0]));
  const sentencesByKanji = new Map(kanji.map((k) => [k.id, 0]));
  const levelById = new Map(kanji.map((k) => [k.id, k.level]));
  for (const vocab of vocabulary) {
    for (const link of vocab.kanji) {
      if (wordsByKanji.has(link.kanjiId)) {
        wordsByKanji.set(link.kanjiId, wordsByKanji.get(link.kanjiId) + 1);
      }
    }
  }
  for (const sentence of sentences) {
    for (const id of sentence.targetKanjiIds) {
      if (sentencesByKanji.has(id)) {
        sentencesByKanji.set(id, sentencesByKanji.get(id) + 1);
      }
    }
  }
  for (const [id, count] of wordsByKanji) {
    const minimum = LEVEL_MINIMUMS[levelById.get(id)]?.words;
    if (minimum !== undefined && count < minimum) {
      errors.push(`Kanji ${id}: ${count} mots (< ${minimum})`);
    }
  }
  for (const [id, count] of sentencesByKanji) {
    const minimum = LEVEL_MINIMUMS[levelById.get(id)]?.sentences;
    if (minimum !== undefined && count < minimum) {
      errors.push(`Kanji ${id}: ${count} phrases (< ${minimum})`);
    }
  }

  const categoryCounts = { meaning: 0, reading: 0, vocabulary: 0, context: 0, stroke: 0, confusion: 0 };
  for (const exercise of exercises) {
    if (!exercise.acceptedAnswers || exercise.acceptedAnswers.length === 0) {
      errors.push(`Exercice ${exercise.id} sans correction`);
      continue;
    }
    const answerNorms = exercise.acceptedAnswers.map(norm);
    if (new Set(answerNorms).size !== answerNorms.length) {
      errors.push(`Exercice ${exercise.id}: plusieurs réponses identiques après normalisation`);
    }
    for (const distractor of exercise.distractors ?? []) {
      if (answerNorms.includes(norm(distractor))) {
        errors.push(`Exercice ${exercise.id}: distracteur identique à la réponse (${distractor})`);
      }
    }
    if (exercise.distractors?.length > 0) {
      const options = [...exercise.acceptedAnswers, ...exercise.distractors].map(norm);
      if (new Set(options).size !== options.length) {
        errors.push(`Exercice ${exercise.id}: options dupliquées après normalisation`);
      }
    }
    if (!kanjiIds.has(exercise.targetKanjiId)) {
      errors.push(`Exercice ${exercise.id} référence un kanji inexistant: ${exercise.targetKanjiId}`);
    }
    if (exercise.vocabularyId && !vocabIds.has(exercise.vocabularyId)) {
      errors.push(`Exercice ${exercise.id} référence un vocabulaire inexistant: ${exercise.vocabularyId}`);
    }
    if (exercise.sentenceId && !sentenceIds.has(exercise.sentenceId)) {
      errors.push(`Exercice ${exercise.id} référence une phrase inexistante: ${exercise.sentenceId}`);
    }
    if (exercise.editorialStatus === 'draft') {
      errors.push(`Exercice ${exercise.id} en état draft dans le pack`);
    }
    const category = TEMPLATE_CATEGORY[exercise.template];
    if (!category) {
      errors.push(`Exercice ${exercise.id}: gabarit inconnu (${exercise.template})`);
    } else {
      categoryCounts[category] += 1;
    }
    if (countByKanji.has(exercise.targetKanjiId)) {
      countByKanji.set(exercise.targetKanjiId, countByKanji.get(exercise.targetKanjiId) + 1);
    }
  }

  for (const [id, count] of countByKanji) {
    const minimum = LEVEL_MINIMUMS[levelById.get(id)]?.exercises;
    if (minimum !== undefined && count < minimum) {
      errors.push(`Kanji ${id}: ${count} exercices (< ${minimum})`);
    }
  }

  const total = exercises.length;
  const exercisesByLevel = {};
  for (const exercise of exercises) {
    exercisesByLevel[exercise.level] = (exercisesByLevel[exercise.level] ?? 0) + 1;
  }
  for (const [level, minimums] of Object.entries(LEVEL_MINIMUMS)) {
    const levelCount = exercisesByLevel[level] ?? 0;
    if (levelCount < minimums.total) {
      errors.push(`Exercices ${level} insuffisants: ${levelCount} (< ${minimums.total})`);
    }
  }
  for (const [category, share] of Object.entries(CATEGORY_SHARES)) {
    const actual = (categoryCounts[category] ?? 0) / total;
    if (Math.abs(actual - share) > SHARE_TOLERANCE) {
      warnings.push(`Répartition ${category}: ${(actual * 100).toFixed(1)} % (attendu ~${share * 100} %)`);
    }
  }

  for (const [level, entries] of Object.entries(curriculum.levels)) {
    const levelKanji = new Set(entries.map((entry) => entry.kanjiId));
    for (const k of kanji.filter((item) => item.level === level)) {
      if (!levelKanji.has(k.id)) {
        errors.push(`Kanji ${k.literal} publié mais absent du curriculum ${level}`);
      }
    }
  }

  const report = {
    stage: 'validate',
    status: errors.length === 0 ? 'ok' : 'echec',
    ranAt: new Date().toISOString(),
    counts: {
      kanji: kanji.length,
      vocabulary: vocabulary.length,
      sentences: sentences.length,
      texts: texts.length,
      exercises: exercises.length,
    },
    categoryCounts,
    errors,
    warnings,
  };
  await writeJson(path.join(REPORTS_DIR, 'validate.json'), report);

  if (errors.length > 0) {
    for (const error of errors.slice(0, 20)) {
      console.error(`[validate] ERREUR: ${error}`);
    }
    if (errors.length > 20) {
      console.error(`[validate] ... et ${errors.length - 20} autres erreurs`);
    }
    throw new Error(`Validation en échec: ${errors.length} erreur(s)`);
  }
  for (const warning of warnings) {
    console.warn(`[validate] avertissement: ${warning}`);
  }
  console.log(`[validate] ok — ${kanji.length} kanji, ${vocabulary.length} mots, ${sentences.length} phrases, ${texts.length} mini-textes, ${exercises.length} exercices`);
}
