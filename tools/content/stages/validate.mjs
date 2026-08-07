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
  sentence_cloze_kanji: 'context',
  sentence_cloze_reading: 'context',
  sentence_translation_qcm: 'context',
  radical_recognition_qcm: 'stroke',
  stroke_count_qcm: 'stroke',
  component_selection_qcm: 'stroke',
  component_search_qcm: 'stroke',
  confusion_pair_qcm: 'confusion',
};

const MIN_EXERCISES_PER_KANJI = 40;
const MIN_SENTENCES_PER_KANJI = 6;
const MIN_WORDS_PER_KANJI = 6;
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
  const [kanji, vocabulary, sentences, curriculum, sources, exercises] = await Promise.all([
    readJson(path.join(NORMALIZED_DIR, 'kanji.json')),
    readJson(path.join(NORMALIZED_DIR, 'vocabulary.json')),
    readJson(path.join(NORMALIZED_DIR, 'sentences.json')),
    readJson(path.join(NORMALIZED_DIR, 'curriculum.json')),
    readJson(path.join(NORMALIZED_DIR, 'sources.json')),
    readJson(path.join(GENERATED_DIR, 'exercises-n5.json')),
  ]);

  const errors = [];
  const warnings = [];

  const kanjiIds = new Set(kanji.map((k) => k.id));
  const vocabIds = new Set(vocabulary.map((v) => v.id));
  const sentenceIds = new Set(sentences.map((s) => s.id));

  const ids = new Set();
  for (const list of [kanji, vocabulary, sentences, exercises]) {
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
    for (const reading of k.readings) {
      if (reading.type === 'onyomi' && !KATAKANA_RE.test(reading.reading)) {
        errors.push(`Lecture on invalide pour ${k.literal}: ${reading.reading}`);
      }
      if (reading.type === 'kunyomi' && !KANA_RE.test(reading.reading)) {
        errors.push(`Lecture kun invalide pour ${k.literal}: ${reading.reading}`);
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
  }

  for (const vocab of vocabulary) {
    if (!vocab.meaningFr) {
      errors.push(`Vocabulaire ${vocab.id} sans traduction française`);
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

  for (const source of sources) {
    if (!source.license) {
      errors.push(`Source ${source.id} sans licence`);
    }
  }

  const countByKanji = new Map(kanji.map((k) => [k.id, 0]));
  const wordsByKanji = new Map(kanji.map((k) => [k.id, 0]));
  const sentencesByKanji = new Map(kanji.map((k) => [k.id, 0]));
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
    if (count < MIN_WORDS_PER_KANJI) {
      errors.push(`Kanji ${id}: ${count} mots (< ${MIN_WORDS_PER_KANJI})`);
    }
  }
  for (const [id, count] of sentencesByKanji) {
    if (count < MIN_SENTENCES_PER_KANJI) {
      errors.push(`Kanji ${id}: ${count} phrases (< ${MIN_SENTENCES_PER_KANJI})`);
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
    if (count < MIN_EXERCISES_PER_KANJI) {
      errors.push(`Kanji ${id}: ${count} exercices (< ${MIN_EXERCISES_PER_KANJI})`);
    }
  }

  const total = exercises.length;
  if (total < 3000) {
    errors.push(`Nombre total d'exercices insuffisant: ${total} (< 3000)`);
  }
  for (const [category, share] of Object.entries(CATEGORY_SHARES)) {
    const actual = (categoryCounts[category] ?? 0) / total;
    if (Math.abs(actual - share) > SHARE_TOLERANCE) {
      warnings.push(`Répartition ${category}: ${(actual * 100).toFixed(1)} % (attendu ~${share * 100} %)`);
    }
  }

  const levelKanji = new Set(curriculum.levels.N5.map((entry) => entry.kanjiId));
  for (const k of kanji) {
    if (!levelKanji.has(k.id)) {
      errors.push(`Kanji ${k.literal} publié mais absent du curriculum`);
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
  console.log(`[validate] ok — ${kanji.length} kanji, ${vocabulary.length} mots, ${sentences.length} phrases, ${exercises.length} exercices`);
}
