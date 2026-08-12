import path from 'node:path';
import { readJson, writeJson } from '../lib/fs-utils.mjs';
import { buildKanjiContext, generateForKanji } from '../lib/generators.mjs';
import { GENERATED_DIR, NORMALIZED_DIR, REPORTS_DIR } from '../lib/paths.mjs';

const DICTATION_ANSWER_RE = /^[ぁ-ゖー]+$/;
const MAX_DICTATION_CHARACTERS = 36;

export function dictationAnswer(sentence) {
  const answer = sentence.tokens
    .map((token) => token.reading)
    .filter((reading) => typeof reading === 'string')
    .join('')
    .replace(/[、。！？!?]/g, '');
  return DICTATION_ANSWER_RE.test(answer) && answer.length <= MAX_DICTATION_CHARACTERS
    ? answer
    : null;
}

export async function stageGenerate() {
  const kanji = await readJson(path.join(NORMALIZED_DIR, 'kanji.json'));
  const vocabulary = await readJson(path.join(NORMALIZED_DIR, 'vocabulary.json'));
  const [sentences, audio] = await Promise.all([
    readJson(path.join(NORMALIZED_DIR, 'sentences.json')),
    readJson(path.join(NORMALIZED_DIR, 'audio.json')),
  ]);
  const curriculum = await readJson(path.join(NORMALIZED_DIR, 'curriculum.json'));

  const pack = { version: curriculum.version, kanji, vocabulary, sentences };
  const ctx = buildKanjiContext(pack);

  const exercises = [];
  for (const k of kanji) {
    exercises.push(...generateForKanji(pack, ctx, k));
  }
  const sentencesById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  for (const resource of audio) {
    const sentence = resource.sentenceId ? sentencesById.get(resource.sentenceId) : undefined;
    const answer = resource.acceptedAnswers?.[0] ?? (sentence ? dictationAnswer(sentence) : null);
    const targetKanjiId = resource.targetKanji
      ? kanji.find((item) => item.literal === resource.targetKanji)?.id
      : sentence?.targetKanjiIds[0];
    if (!sentence || !answer || !targetKanjiId) {
      continue;
    }
    exercises.push({
      id: `x-audio-dictation-${resource.id}`,
      template: 'audio_dictation_kana',
      skill: 'listening',
      level: sentence.difficulty,
      targetKanjiId,
      vocabularyId: resource.vocabularyId,
      sentenceId: resource.sentenceId,
      audioResourceId: resource.id,
      prompt: { audioResourceId: resource.id, instruction: 'Écoutez puis écrivez la phrase entendue en kana.' },
      acceptedAnswers: [answer],
      distractors: [],
      explanation: `${sentence.japanese} se lit ${answer}。`,
      difficulty: 2,
      sourceId: 'tatoeba_audio',
      editorialStatus: 'reviewed',
    });
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
