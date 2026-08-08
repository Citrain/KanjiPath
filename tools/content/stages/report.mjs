import path from 'node:path';
import { readJson, writeJson } from '../lib/fs-utils.mjs';
import { GENERATED_DIR, NORMALIZED_DIR, REPORTS_DIR } from '../lib/paths.mjs';

export async function stageReport() {
  const [kanji, vocabulary, sentences, curriculum, exercises, validateReport] = await Promise.all([
    readJson(path.join(NORMALIZED_DIR, 'kanji.json')),
    readJson(path.join(NORMALIZED_DIR, 'vocabulary.json')),
    readJson(path.join(NORMALIZED_DIR, 'sentences.json')),
    readJson(path.join(NORMALIZED_DIR, 'curriculum.json')),
    readJson(path.join(GENERATED_DIR, 'exercises.json')),
    readJson(path.join(REPORTS_DIR, 'validate.json')).catch(() => null),
  ]);

  const wordsByKanji = new Map(kanji.map((k) => [k.id, 0]));
  const sentencesByKanji = new Map(kanji.map((k) => [k.id, 0]));
  const exercisesByKanji = new Map(kanji.map((k) => [k.id, 0]));
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
  for (const exercise of exercises) {
    if (exercisesByKanji.has(exercise.targetKanjiId)) {
      exercisesByKanji.set(exercise.targetKanjiId, exercisesByKanji.get(exercise.targetKanjiId) + 1);
    }
  }

  const coverage = Object.entries(curriculum.levels).flatMap(([level, entries]) =>
    entries.map((entry) => ({
      level,
      kanjiId: entry.kanjiId,
      literal: entry.literal,
      order: entry.order,
      words: wordsByKanji.get(entry.kanjiId) ?? 0,
      sentences: sentencesByKanji.get(entry.kanjiId) ?? 0,
      exercises: exercisesByKanji.get(entry.kanjiId) ?? 0,
    })),
  );

  const min = (map) => Math.min(...map.values());

  const report = {
    stage: 'report',
    status: 'ok',
    ranAt: new Date().toISOString(),
    counts: {
      kanji: kanji.length,
      vocabulary: vocabulary.length,
      sentences: sentences.length,
      exercises: exercises.length,
    },
    minimums: {
      wordsPerKanji: min(wordsByKanji),
      sentencesPerKanji: min(sentencesByKanji),
      exercisesPerKanji: min(exercisesByKanji),
    },
    validation: validateReport
      ? { status: validateReport.status, errors: validateReport.errors.length, warnings: validateReport.warnings.length }
      : null,
    coverage,
  };
  await writeJson(path.join(REPORTS_DIR, 'report.json'), report);
  console.log(
    `[report] couverture min: ${report.minimums.wordsPerKanji} mots, ${report.minimums.sentencesPerKanji} phrases, ${report.minimums.exercisesPerKanji} exercices par kanji`,
  );
}
