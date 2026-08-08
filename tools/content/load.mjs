import fs from 'node:fs';
import path from 'node:path';
import { createDbAdapter } from '../../apps/api/src/infrastructure/database/prisma.adapter.ts';
import { PrismaClient } from '../../apps/api/src/generated/prisma/client.ts';
import { readJson } from './lib/fs-utils.mjs';
import { PACK_DIR, MANIFESTS_DIR, ROOT } from './lib/paths.mjs';

function loadEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('DATABASE_URL manquant et .env introuvable');
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const value = match[2].replace(/^"/, '').replace(/"$/, '');
    if (!process.env[match[1]]) {
      process.env[match[1]] = value;
    }
  }
}

const TEMPLATE_META = {
  kanji_to_meaning_qcm: { skill: 'meaning', renderer: 'qcm', grader: 'exact-match' },
  meaning_to_kanji_qcm: { skill: 'meaning', renderer: 'qcm', grader: 'exact-match' },
  kanji_to_reading_qcm: { skill: 'reading', renderer: 'qcm', grader: 'kana-normalize' },
  reading_input_kana: { skill: 'reading', renderer: 'input', grader: 'kana-normalize' },
  reading_type_qcm: { skill: 'reading', renderer: 'qcm', grader: 'exact-match' },
  vocab_reading_qcm: { skill: 'vocabulary', renderer: 'qcm', grader: 'kana-normalize' },
  vocab_meaning_qcm: { skill: 'vocabulary', renderer: 'qcm', grader: 'exact-match' },
  vocab_reading_advanced_qcm: { skill: 'reading', renderer: 'qcm', grader: 'kana-normalize' },
  sentence_cloze_kanji: { skill: 'context', renderer: 'cloze-qcm', grader: 'exact-match' },
  sentence_cloze_reading: { skill: 'context', renderer: 'cloze-qcm', grader: 'kana-normalize' },
  sentence_translation_qcm: { skill: 'context', renderer: 'qcm', grader: 'exact-match' },
  radical_recognition_qcm: { skill: 'stroke', renderer: 'qcm', grader: 'exact-match' },
  stroke_count_qcm: { skill: 'stroke', renderer: 'qcm', grader: 'numeric' },
  component_selection_qcm: { skill: 'stroke', renderer: 'qcm', grader: 'set-match' },
  component_search_qcm: { skill: 'stroke', renderer: 'qcm', grader: 'exact-match' },
  confusion_pair_qcm: { skill: 'meaning', renderer: 'qcm', grader: 'exact-match' },
};

async function loadSources(prisma, sources) {
  for (const source of sources) {
    await prisma.contentSource.upsert({
      where: { id: source.id },
      create: {
        id: source.id,
        name: source.name,
        url: source.url,
        license: source.license,
        attributionText: source.attributionText,
        sourceVersion: source.sourceVersion,
        checksum: source.checksums?.[0]?.sha256 ?? null,
      },
      update: {
        name: source.name,
        url: source.url,
        license: source.license,
        attributionText: source.attributionText,
        sourceVersion: source.sourceVersion,
        checksum: source.checksums?.[0]?.sha256 ?? null,
      },
    });
  }
}

async function loadKanji(prisma, kanjiList, versionId) {
  for (const kanji of kanjiList) {
    let radicalId = null;
    if (kanji.radical) {
      const radId = `rad-${kanji.radical.literal}`;
      await prisma.radical.upsert({
        where: { id: radId },
        create: {
          id: radId,
          literal: kanji.radical.literal,
          nameFr: kanji.radical.nameFr,
          meaningFr: kanji.radical.meaningFr,
        },
        update: {
          nameFr: kanji.radical.nameFr,
          meaningFr: kanji.radical.meaningFr,
        },
      });
      radicalId = radId;
    }

    await prisma.kanji.upsert({
      where: { id: kanji.id },
      create: {
        id: kanji.id,
        literal: kanji.literal,
        unicodeCodepoint: kanji.unicodeCodepoint,
        strokeCount: kanji.strokeCount,
        frequencyRank: kanji.frequencyRank,
        schoolGrade: kanji.schoolGrade,
        kanjivgPath: kanji.kanjivgPath,
        status: kanji.editorialStatus,
        contentVersionId: versionId,
        primaryRadicalId: radicalId,
      },
      update: {
        strokeCount: kanji.strokeCount,
        frequencyRank: kanji.frequencyRank,
        schoolGrade: kanji.schoolGrade,
        kanjivgPath: kanji.kanjivgPath,
        status: kanji.editorialStatus,
        contentVersionId: versionId,
        primaryRadicalId: radicalId,
      },
    });

    await prisma.kanjiMeaning.deleteMany({ where: { kanjiId: kanji.id } });
    await prisma.kanjiReading.deleteMany({ where: { kanjiId: kanji.id } });
    await prisma.kanjiComponent.deleteMany({ where: { kanjiId: kanji.id } });

    if (kanji.meanings.length > 0) {
      await prisma.kanjiMeaning.createMany({
        data: kanji.meanings.map((m) => ({
          kanjiId: kanji.id,
          language: m.language,
          meaning: m.meaning,
          isPrimary: m.isPrimary,
          sourceId: kanji.sourceId,
          editorialStatus: kanji.editorialStatus,
        })),
      });
    }
    if (kanji.readings.length > 0) {
      await prisma.kanjiReading.createMany({
        data: kanji.readings.map((r) => ({
          kanjiId: kanji.id,
          reading: r.reading,
          romaji: r.romaji ?? null,
          readingType: r.type,
          okurigana: r.okurigana ?? null,
          commonness: r.commonness,
          sourceId: kanji.sourceId,
        })),
      });
    }

    for (let position = 0; position < kanji.components.length; position += 1) {
      const component = kanji.components[position];
      const componentId = `comp-${component.literal}`;
      await prisma.component.upsert({
        where: { id: componentId },
        create: {
          id: componentId,
          literal: component.literal,
          nameFr: component.nameFr,
          meaningFr: component.meaningFr,
          componentType: 'kanji',
        },
        update: {
          nameFr: component.nameFr,
          meaningFr: component.meaningFr,
        },
      });
      await prisma.kanjiComponent.upsert({
        where: { kanjiId_componentId: { kanjiId: kanji.id, componentId } },
        create: {
          kanjiId: kanji.id,
          componentId,
          position,
          isRadical: component.literal === kanji.radical?.literal,
          role: component.role,
          sourceId: 'kradfile',
        },
        update: {
          position,
          role: component.role,
        },
      });
    }

    if (kanji.mnemonicFr || kanji.etymologyFr || kanji.confusions) {
      await prisma.kanjiNotes.upsert({
        where: { kanjiId: kanji.id },
        create: {
          kanjiId: kanji.id,
          mnemonicFr: kanji.mnemonicFr,
          etymologyFr: kanji.etymologyFr,
          etymologySource: kanji.etymologySource,
          confusions: kanji.confusions,
          editorialStatus: kanji.editorialStatus,
        },
        update: {
          mnemonicFr: kanji.mnemonicFr,
          etymologyFr: kanji.etymologyFr,
          etymologySource: kanji.etymologySource,
          confusions: kanji.confusions,
          editorialStatus: kanji.editorialStatus,
        },
      });
    }
  }
}

async function loadCurriculum(prisma, curriculum) {
  const curriculumId = `curr-${curriculum.code}`;
  await prisma.curriculum.upsert({
    where: { id: curriculumId },
    create: {
      id: curriculumId,
      code: curriculum.code,
      name: curriculum.name,
      version: curriculum.version,
      status: curriculum.status,
      publishedAt: curriculum.publishedAt ? new Date(curriculum.publishedAt) : new Date(),
    },
    update: {
      name: curriculum.name,
      version: curriculum.version,
      status: curriculum.status,
    },
  });
  await prisma.curriculumKanji.deleteMany({ where: { curriculumId } });
  for (const [level, entries] of Object.entries(curriculum.levels)) {
    if (entries.length === 0) {
      continue;
    }
    await prisma.curriculumKanji.createMany({
      data: entries.map((entry) => ({
        curriculumId,
        kanjiId: entry.kanjiId,
        level,
        order: entry.order,
        confidence: entry.confidence,
        reviewedAt: new Date(),
      })),
    });
  }
}

async function loadVocabulary(prisma, vocabulary) {
  for (const vocab of vocabulary) {
    await prisma.vocabulary.upsert({
      where: { id: vocab.id },
      create: {
        id: vocab.id,
        externalId: vocab.externalId,
        writtenForm: vocab.writtenForm,
        reading: vocab.reading,
        romaji: vocab.romaji ?? null,
        meaningFr: vocab.meaningFr,
        partOfSpeech: vocab.partOfSpeech,
        frequencyRank: vocab.frequencyRank,
        estimatedLevel: vocab.estimatedLevel,
        sourceId: vocab.sourceId,
        editorialStatus: vocab.editorialStatus,
      },
      update: {
        writtenForm: vocab.writtenForm,
        reading: vocab.reading,
        romaji: vocab.romaji ?? null,
        meaningFr: vocab.meaningFr,
        partOfSpeech: vocab.partOfSpeech,
        estimatedLevel: vocab.estimatedLevel,
        editorialStatus: vocab.editorialStatus,
      },
    });
    await prisma.vocabularyKanji.deleteMany({ where: { vocabularyId: vocab.id } });
    if (vocab.kanji.length > 0) {
      await prisma.vocabularyKanji.createMany({
        data: vocab.kanji.map((link) => ({
          vocabularyId: vocab.id,
          kanjiId: link.kanjiId,
          position: link.position,
          readingInWord: link.readingInWord ?? null,
        })),
      });
    }
  }
}

async function loadSentences(prisma, sentences) {
  for (const sentence of sentences) {
    await prisma.sentence.upsert({
      where: { id: sentence.id },
      create: {
        id: sentence.id,
        externalId: sentence.externalId,
        japanese: sentence.japanese,
        translationFr: sentence.translationFr,
        difficulty: sentence.difficulty,
        sourceId: sentence.sourceId,
        author: sentence.author,
        license: sentence.license,
        editorialStatus: sentence.editorialStatus,
      },
      update: {
        japanese: sentence.japanese,
        translationFr: sentence.translationFr,
        difficulty: sentence.difficulty,
        author: sentence.author,
        license: sentence.license,
        editorialStatus: sentence.editorialStatus,
      },
    });
    await prisma.sentenceToken.deleteMany({ where: { sentenceId: sentence.id } });
    if ((sentence.tokens ?? []).length > 0) {
      await prisma.sentenceToken.createMany({
        data: sentence.tokens.map((token) => ({
          sentenceId: sentence.id,
          surface: token.surface,
          reading: token.reading ?? null,
          romaji: token.romaji ?? null,
          startOffset: token.startOffset,
          endOffset: token.endOffset,
          vocabularyId: token.vocabularyId ?? null,
        })),
      });
    }
  }
}

async function loadMiniTexts(prisma, texts) {
  for (const text of texts) {
    await prisma.miniText.upsert({
      where: { id: text.id },
      create: {
        id: text.id,
        title: text.title,
        body: text.body,
        translationFr: text.translationFr,
        level: text.level,
        sourceId: text.sourceId,
        author: text.author,
        license: text.license,
        editorialStatus: text.editorialStatus,
      },
      update: {
        title: text.title,
        body: text.body,
        translationFr: text.translationFr,
        level: text.level,
        author: text.author,
        license: text.license,
        editorialStatus: text.editorialStatus,
      },
    });
    await prisma.miniTextToken.deleteMany({ where: { miniTextId: text.id } });
    if ((text.tokens ?? []).length > 0) {
      await prisma.miniTextToken.createMany({
        data: text.tokens.map((token) => ({
          miniTextId: text.id,
          surface: token.surface,
          reading: token.reading ?? null,
          romaji: token.romaji ?? null,
          startOffset: token.startOffset,
          endOffset: token.endOffset,
        })),
      });
    }
  }
}

async function loadExercises(prisma, exercises, versionId) {
  const templates = new Map();
  for (const exercise of exercises) {
    if (!templates.has(exercise.template)) {
      templates.set(exercise.template, TEMPLATE_META[exercise.template] ?? {
        skill: exercise.skill,
        renderer: 'qcm',
        grader: 'exact-match',
      });
    }
  }
  for (const [type, meta] of templates) {
    const templateId = `tpl-${type}`;
    await prisma.exerciseTemplate.upsert({
      where: { id: templateId },
      create: {
        id: templateId,
        type,
        skill: meta.skill,
        schemaVersion: 1,
        renderer: meta.renderer,
        grader: meta.grader,
      },
      update: {
        skill: meta.skill,
        renderer: meta.renderer,
        grader: meta.grader,
      },
    });
  }

  for (const exercise of exercises) {
    await prisma.exerciseItem.upsert({
      where: { externalId: exercise.id },
      create: {
        externalId: exercise.id,
        templateId: `tpl-${exercise.template}`,
        level: exercise.level,
        skill: exercise.skill,
        kanjiId: exercise.targetKanjiId,
        vocabularyId: exercise.vocabularyId ?? null,
        sentenceId: exercise.sentenceId ?? null,
        promptJson: exercise.prompt,
        answerJson: { acceptedAnswers: exercise.acceptedAnswers, distractors: exercise.distractors ?? [] },
        explanationJson: { explanation: exercise.explanation },
        difficulty: exercise.difficulty,
        sourceId: exercise.sourceId,
        contentVersionId: versionId,
        editorialStatus: exercise.editorialStatus,
      },
      update: {
        templateId: `tpl-${exercise.template}`,
        level: exercise.level,
        skill: exercise.skill,
        kanjiId: exercise.targetKanjiId,
        vocabularyId: exercise.vocabularyId ?? null,
        sentenceId: exercise.sentenceId ?? null,
        promptJson: exercise.prompt,
        answerJson: { acceptedAnswers: exercise.acceptedAnswers, distractors: exercise.distractors ?? [] },
        explanationJson: { explanation: exercise.explanation },
        difficulty: exercise.difficulty,
        sourceId: exercise.sourceId,
        contentVersionId: versionId,
        editorialStatus: exercise.editorialStatus,
      },
    });
  }
}

async function cleanupOrphans(prisma, packIds) {
  const orphanExercises = await prisma.exerciseItem.findMany({
    where: { externalId: { notIn: packIds.exercises } },
    select: { id: true },
  });
  const orphanExerciseIds = orphanExercises.map((e) => e.id);
  const referenced = new Set([
    ...(await prisma.studySessionItem.findMany({
      where: { exerciseItemId: { in: orphanExerciseIds } },
      select: { exerciseItemId: true },
    })).map((row) => row.exerciseItemId),
    ...(await prisma.reviewLog.findMany({
      where: { exerciseItemId: { in: orphanExerciseIds } },
      select: { exerciseItemId: true },
    })).map((row) => row.exerciseItemId),
  ]);
  const deletable = orphanExerciseIds.filter((id) => !referenced.has(id));
  if (deletable.length > 0) {
    await prisma.exerciseItem.deleteMany({ where: { id: { in: deletable } } });
  }
  console.log(
    `[load] nettoyage: ${deletable.length} exercices orphelins supprimés, ${referenced.size} conservés (historique utilisateur)`,
  );

  const orphanVocab = await prisma.vocabulary.findMany({
    where: { id: { notIn: packIds.vocabulary } },
    select: { id: true },
  });
  const orphanVocabIds = orphanVocab.map((v) => v.id);
  if (orphanVocabIds.length > 0) {
    await prisma.sentenceToken.updateMany({
      where: { vocabularyId: { in: orphanVocabIds } },
      data: { vocabularyId: null },
    });
    await prisma.exerciseItem.updateMany({
      where: { vocabularyId: { in: orphanVocabIds } },
      data: { vocabularyId: null },
    });
    await prisma.vocabularyKanji.deleteMany({ where: { vocabularyId: { in: orphanVocabIds } } });
    await prisma.vocabulary.deleteMany({ where: { id: { in: orphanVocabIds } } });
  }
  console.log(`[load] nettoyage: ${orphanVocabIds.length} mots orphelins supprimés`);

  const orphanSentences = await prisma.sentence.findMany({
    where: { id: { notIn: packIds.sentences } },
    select: { id: true },
  });
  const orphanSentenceIds = orphanSentences.map((s) => s.id);
  if (orphanSentenceIds.length > 0) {
    await prisma.exerciseItem.updateMany({
      where: { sentenceId: { in: orphanSentenceIds } },
      data: { sentenceId: null },
    });
    await prisma.sentenceToken.deleteMany({ where: { sentenceId: { in: orphanSentenceIds } } });
    await prisma.sentence.deleteMany({ where: { id: { in: orphanSentenceIds } } });
  }
  console.log(`[load] nettoyage: ${orphanSentenceIds.length} phrases orphelines supprimées`);

  const orphanTexts = await prisma.miniText.findMany({
    where: { id: { notIn: packIds.texts } },
    select: { id: true },
  });
  const orphanTextIds = orphanTexts.map((t) => t.id);
  if (orphanTextIds.length > 0) {
    await prisma.miniTextToken.deleteMany({ where: { miniTextId: { in: orphanTextIds } } });
    await prisma.miniText.deleteMany({ where: { id: { in: orphanTextIds } } });
  }
  console.log(`[load] nettoyage: ${orphanTextIds.length} mini-textes orphelins supprimés`);
}

export async function stageLoad() {
  loadEnv();
  const prisma = new PrismaClient({ adapter: createDbAdapter() });

  const [kanji, vocabulary, sentences, texts, exercises, curriculum, sources] = await Promise.all([
    readJson(path.join(PACK_DIR, 'kanji.json')),
    readJson(path.join(PACK_DIR, 'vocabulary.json')),
    readJson(path.join(PACK_DIR, 'sentences.json')),
    readJson(path.join(PACK_DIR, 'texts.json')),
    readJson(path.join(PACK_DIR, 'exercises.json')),
    readJson(path.join(PACK_DIR, 'curriculum.json')),
    readJson(path.join(PACK_DIR, 'sources.json')),
  ]);
  const manifest = await readJson(path.join(MANIFESTS_DIR, `${curriculum.version}.json`));

  const versionId = `ver-${curriculum.version}`;
  const levelList = Object.entries(curriculum.levels)
    .filter(([, entries]) => entries.length > 0)
    .map(([level]) => level)
    .join('+');
  await prisma.contentVersion.upsert({
    where: { id: versionId },
    create: {
      id: versionId,
      version: curriculum.version,
      gitCommit: manifest.gitCommit,
      notes: `Pack ${levelList} publié par le pipeline de contenu`,
    },
    update: { gitCommit: manifest.gitCommit },
  });

  console.log('[load] sources...');
  await loadSources(prisma, sources);
  console.log('[load] kanji + sens + lectures + composants...');
  await loadKanji(prisma, kanji, versionId);
  console.log('[load] curriculum...');
  await loadCurriculum(prisma, curriculum);
  console.log('[load] vocabulaire...');
  await loadVocabulary(prisma, vocabulary);
  console.log('[load] phrases...');
  await loadSentences(prisma, sentences);
  console.log('[load] mini-textes...');
  await loadMiniTexts(prisma, texts);
  console.log('[load] exercices...');
  await loadExercises(prisma, exercises, versionId);
  console.log('[load] nettoyage des contenus orphelins...');
  await cleanupOrphans(prisma, {
    vocabulary: vocabulary.map((v) => v.id),
    sentences: sentences.map((s) => s.id),
    texts: texts.map((t) => t.id),
    exercises: exercises.map((e) => e.id),
  });

  const counts = {
    kanji: await prisma.kanji.count(),
    vocabulary: await prisma.vocabulary.count(),
    sentences: await prisma.sentence.count(),
    texts: await prisma.miniText.count(),
    exercises: await prisma.exerciseItem.count(),
  };
  console.log(`[load] terminé: ${JSON.stringify(counts)}`);
  await prisma.$disconnect();
}
