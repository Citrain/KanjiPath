import path from 'node:path';
import { execSync } from 'node:child_process';
import { readJson, writeJson } from '../lib/fs-utils.mjs';
import { GENERATED_DIR, MANIFESTS_DIR, NORMALIZED_DIR, PACK_DIR, REPORTS_DIR } from '../lib/paths.mjs';

export async function stagePublish() {
  const [kanji, vocabulary, sentences, texts, audio, curriculum, sources, exercises, validateReport] = await Promise.all([
    readJson(path.join(NORMALIZED_DIR, 'kanji.json')),
    readJson(path.join(NORMALIZED_DIR, 'vocabulary.json')),
    readJson(path.join(NORMALIZED_DIR, 'sentences.json')),
    readJson(path.join(NORMALIZED_DIR, 'texts.json')),
    readJson(path.join(NORMALIZED_DIR, 'audio.json')),
    readJson(path.join(NORMALIZED_DIR, 'curriculum.json')),
    readJson(path.join(NORMALIZED_DIR, 'sources.json')),
    readJson(path.join(GENERATED_DIR, 'exercises.json')),
    readJson(path.join(REPORTS_DIR, 'validate.json')),
  ]);

  if (validateReport.status !== 'ok') {
    throw new Error('Publication refusée : validation en échec');
  }

  const publishedKanji = kanji.map((k) => ({ ...k, editorialStatus: 'published' }));
  const publishedVocabulary = vocabulary.map((v) => ({ ...v, editorialStatus: 'published' }));
  const publishedSentences = sentences.map((s) => ({ ...s, editorialStatus: 'published' }));
  const publishedTexts = texts.map((t) => ({ ...t, editorialStatus: 'published' }));
  const publishedAudio = audio.map((item) => ({ ...item, editorialStatus: 'published' }));
  const publishedExercises = exercises.map((e) => ({ ...e, editorialStatus: 'published' }));
  const publishedCurriculum = { ...curriculum, status: 'published', publishedAt: new Date().toISOString() };

  await writeJson(path.join(PACK_DIR, 'kanji.json'), publishedKanji);
  await writeJson(path.join(PACK_DIR, 'vocabulary.json'), publishedVocabulary);
  await writeJson(path.join(PACK_DIR, 'sentences.json'), publishedSentences);
  await writeJson(path.join(PACK_DIR, 'texts.json'), publishedTexts);
  await writeJson(path.join(PACK_DIR, 'audio.json'), publishedAudio);
  await writeJson(path.join(PACK_DIR, 'exercises.json'), publishedExercises);
  await writeJson(path.join(PACK_DIR, 'curriculum.json'), publishedCurriculum);
  await writeJson(path.join(PACK_DIR, 'sources.json'), sources);

  let gitCommit = null;
  try {
    gitCommit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    gitCommit = null;
  }

  const manifest = {
    version: curriculum.version,
    createdAt: new Date().toISOString(),
    gitCommit,
    sources: sources
      .filter((source) => source.checksums.length > 0)
      .map((source) => ({
        name: source.name,
        license: source.license,
        version: source.sourceVersion,
        checksums: source.checksums,
      })),
    counts: {
      kanji: publishedKanji.length,
      vocabulary: publishedVocabulary.length,
      sentences: publishedSentences.length,
      texts: publishedTexts.length,
      audio: publishedAudio.length,
      exercises: publishedExercises.length,
    },
    validation: {
      errors: validateReport.errors.length,
      warnings: validateReport.warnings.length,
    },
  };
  await writeJson(path.join(MANIFESTS_DIR, `${curriculum.version}.json`), manifest);
  console.log(`[publish] pack ${curriculum.version} publié (${manifest.counts.exercises} exercices)`);
}
