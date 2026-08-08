import path from 'node:path';
import { readJson, writeJson } from '../lib/fs-utils.mjs';
import { buildKanjiContext, generateForKanji } from '../lib/generators.mjs';
import { GENERATED_DIR, NORMALIZED_DIR, REPORTS_DIR } from '../lib/paths.mjs';

export async function stageGenerate() {
  const kanji = await readJson(path.join(NORMALIZED_DIR, 'kanji.json'));
  const vocabulary = await readJson(path.join(NORMALIZED_DIR, 'vocabulary.json'));
  const sentences = await readJson(path.join(NORMALIZED_DIR, 'sentences.json'));
  const curriculum = await readJson(path.join(NORMALIZED_DIR, 'curriculum.json'));

  const pack = { version: curriculum.version, kanji, vocabulary, sentences };
  const ctx = buildKanjiContext(pack);

  const exercises = [];
  for (const k of kanji) {
    exercises.push(...generateForKanji(pack, ctx, k));
  }

  const ids = new Set();
  for (const exercise of exercises) {
    if (ids.has(exercise.id)) {
      throw new Error(`Identifiant d'exercice dupliqué: ${exercise.id}`);
    }
    ids.add(exercise.id);
  }

  await writeJson(path.join(GENERATED_DIR, 'exercises.json'), exercises);

  const bySkill = {};
  for (const exercise of exercises) {
    bySkill[exercise.skill] = (bySkill[exercise.skill] ?? 0) + 1;
  }
  const byKanji = {};
  for (const exercise of exercises) {
    byKanji[exercise.targetKanjiId] = (byKanji[exercise.targetKanjiId] ?? 0) + 1;
  }
  const minPerKanji = Math.min(...Object.values(byKanji));

  await writeJson(path.join(REPORTS_DIR, 'generate.json'), {
    stage: 'generate',
    status: 'ok',
    ranAt: new Date().toISOString(),
    total: exercises.length,
    bySkill,
    minPerKanji,
  });

  console.log(`[generate] ${exercises.length} exercices générés (min ${minPerKanji}/kanji)`);
  console.log(`[generate] répartition: ${Object.entries(bySkill).map(([s, n]) => `${s}=${n}`).join(', ')}`);
}
