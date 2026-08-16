import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { csrfCookiePlugin } from '../src/infrastructure/security/csrf-cookie.plugin';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST ?? '';
const describeWithDb = DATABASE_URL_TEST.length > 0 ? describe : describe.skip;

interface ParsedCookie {
  name: string;
  value: string;
  httpOnly?: boolean;
}

function findCookie(response: { cookies: ParsedCookie[] }, name: string): ParsedCookie | undefined {
  return response.cookies.find((entry) => entry.name === name);
}

const PROGRESS_LITERALS = ['下', '何', '花', '会', '社', '名', '山', '川', '田', '中', '大', '小'];

describeWithDb('mode immersion (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const email = `immersion-${Date.now()}@example.com`;
  const password = 'mot-de-passe-e2e';
  let sessionCookie = '';
  let csrfToken = '';
  let userId = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL_TEST;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(cookie);
    await app.register(csrfCookiePlugin);
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    await seedContent(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function fetchCsrf(): Promise<void> {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    csrfToken = findCookie(response, 'kp_csrf')?.value ?? '';
  }

  it("exige une session authentifiée pour lire et modifier l'immersion", async () => {
    const get = await app.inject({ method: 'GET', url: '/api/v1/settings' });
    expect(get.statusCode).toBe(401);

    await fetchCsrf();
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { immersionEnabled: true },
    });
    expect(patch.statusCode).toBe(401);
    const noCsrf = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      payload: { immersionEnabled: true },
    });
    expect(noCsrf.statusCode).toBe(403);
  });

  it('inscrit un utilisateur', async () => {
    await fetchCsrf();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password, displayName: 'Immersion E2E' },
    });
    expect(response.statusCode).toBe(201);
    sessionCookie = `kp_session=${findCookie(response, 'kp_session')?.value}`;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Utilisateur de test introuvable');
    }
    userId = user.id;
  });

  it("recommande l'affichage complet pour un débutant et explique le choix", async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.immersionEnabled).toBe(false);
    expect(body.immersionHelpLevel).toBeNull();
    expect(body.immersionRecommendation.level).toBe(0);
    expect(body.immersionRecommendation.reasons.length).toBeGreaterThan(0);
  });

  it("persiste l'activation et le niveau d'aide choisi", async () => {
    await fetchCsrf();
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { immersionEnabled: true, immersionHelpLevel: 2 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().immersionEnabled).toBe(true);
    expect(patch.json().immersionHelpLevel).toBe(2);

    const get = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { cookie: sessionCookie },
    });
    expect(get.json().immersionEnabled).toBe(true);
    expect(get.json().immersionHelpLevel).toBe(2);
  });

  it('autorise le retour à la recommandation et rejette les valeurs invalides', async () => {
    await fetchCsrf();
    const reset = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { immersionHelpLevel: null },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().immersionHelpLevel).toBeNull();

    for (const payload of [
      { immersionHelpLevel: 4 },
      { immersionHelpLevel: -1 },
      { immersionHelpLevel: 'totale' },
      { immersionEnabled: 'oui' },
      { reglageInconnu: 1 },
    ]) {
      const invalid = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        cookies: { kp_csrf: csrfToken },
        headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
        payload,
      });
      expect(invalid.statusCode).toBe(400);
    }
  });

  let readingExerciseId = '';

  it("répond à un exercice avec l'immersion active sans changer la correction", async () => {
    await fetchCsrf();
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { immersionEnabled: true, immersionHelpLevel: 3 },
    });

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'targeted', target: { kanjiIds: ['k-imm-1'] } },
    });
    expect(created.statusCode).toBe(201);
    const items = created.json().items;
    expect(items.length).toBeGreaterThan(0);
    const reading = items.find(
      (item: { template: string }) => item.template === 'vocab_reading_qcm',
    );
    expect(reading).toBeTruthy();
    readingExerciseId = reading.exerciseItemId;

    const exercise = await prisma.exerciseItem.findUnique({ where: { id: readingExerciseId } });
    const accepted = (exercise?.answerJson as { acceptedAnswers?: string[] })?.acceptedAnswers?.[0];
    expect(accepted).toBeTruthy();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/answers',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { exerciseItemId: readingExerciseId, answer: accepted, responseTimeMs: 900 },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().correct).toBe(true);

    const resume = await app.inject({
      method: 'GET',
      url: '/api/v1/study/resume',
      headers: { cookie: sessionCookie },
    });
    const sessionId = resume.json().session?.id;
    expect(sessionId).toBeTruthy();
    const finished = await app.inject({
      method: 'POST',
      url: `/api/v1/study/sessions/${sessionId}/finish`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(finished.statusCode).toBe(204);
  });

  it("modifier l'immersion ne modifie ni cartes FSRS, ni journaux, ni progression", async () => {
    const before = await progressionSnapshot(prisma, userId);
    expect(before.cards.length).toBeGreaterThan(0);
    expect(before.logs.length).toBeGreaterThan(0);
    await fetchCsrf();
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { immersionEnabled: false, immersionHelpLevel: 0 },
    });
    expect(patch.statusCode).toBe(200);
    const after = await progressionSnapshot(prisma, userId);
    expect(after).toEqual(before);
  });

  it('ne révèle jamais la clé de correction dans la file, immersion activée ou non', async () => {
    const exercise = await prisma.exerciseItem.findUnique({ where: { id: readingExerciseId } });
    const accepted = (exercise?.answerJson as { acceptedAnswers?: string[] })?.acceptedAnswers?.[0];
    expect(accepted).toBeTruthy();
    const promptSource = JSON.stringify(exercise?.promptJson ?? {});
    expect(promptSource).not.toContain(accepted);

    await fetchCsrf();
    for (const immersion of [true, false]) {
      await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        cookies: { kp_csrf: csrfToken },
        headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
        payload: { immersionEnabled: immersion, immersionHelpLevel: immersion ? 3 : 0 },
      });
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/study/sessions',
        cookies: { kp_csrf: csrfToken },
        headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
        payload: { mode: 'targeted', target: { kanjiIds: ['k-imm-1'] } },
      });
      expect(created.statusCode).toBe(201);
      const item = created
        .json()
        .items.find(
          (entry: { exerciseItemId: string }) => entry.exerciseItemId === readingExerciseId,
        );
      expect(item).toBeTruthy();
      expect(JSON.stringify(item.prompt)).not.toContain(accepted);
      expect(item.prompt.wordReading ?? null).toBeNull();
      expect(item.prompt.wordRomaji ?? null).toBeNull();
      const sessionId = created.json().session.id;
      await app.inject({
        method: 'POST',
        url: `/api/v1/study/sessions/${sessionId}/abandon`,
        cookies: { kp_csrf: csrfToken },
        headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      });
    }
  });

  it('la recommandation suit la progression enregistrée', async () => {
    for (const [index, literal] of PROGRESS_LITERALS.entries()) {
      const kanjiId = `k-imm-progress-${index}`;
      await prisma.kanji.upsert({
        where: { id: kanjiId },
        create: {
          id: kanjiId,
          literal,
          unicodeCodepoint: `U+${literal.codePointAt(0)?.toString(16).toUpperCase()}`,
          strokeCount: 3,
          status: 'published',
          contentVersionId: 'ver-imm-test',
        },
        update: {},
      });
      await prisma.userKanjiProgress.upsert({
        where: { userId_kanjiId: { userId, kanjiId } },
        create: {
          userId,
          kanjiId,
          status: index < 8 ? 'mastered' : 'learning',
          overallScore: index < 8 ? 0.95 : 0.4,
        },
        update: { status: index < 8 ? 'mastered' : 'learning' },
      });
    }
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { cookie: sessionCookie },
    });
    const body = response.json();
    expect(body.immersionRecommendation.level).toBe(2);
    expect(body.immersionRecommendation.reasons.join(' ')).toContain('maîtrisés');
  });
});

async function progressionSnapshot(prisma: PrismaService, userId: string): Promise<unknown> {
  const [cards, logs, progress] = await Promise.all([
    prisma.reviewCard.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        skill: true,
        state: true,
        dueAt: true,
        reps: true,
        stability: true,
        difficulty: true,
      },
    }),
    prisma.reviewLog.findMany({
      where: { reviewCard: { userId } },
      orderBy: { id: 'asc' },
      select: { id: true, rating: true, wasCorrect: true, exerciseItemId: true },
    }),
    prisma.userKanjiProgress.findMany({
      where: { userId },
      orderBy: { kanjiId: 'asc' },
      select: {
        kanjiId: true,
        status: true,
        overallScore: true,
        meaningScore: true,
        readingScore: true,
        vocabularyScore: true,
        contextScore: true,
        strokeScore: true,
      },
    }),
  ]);
  return { cards, logs, progress };
}

async function seedContent(prisma: PrismaService): Promise<void> {
  const source = await prisma.contentSource.upsert({
    where: { id: 'kanjipath-editorial' },
    create: {
      id: 'kanjipath-editorial',
      name: 'KanjiPath éditorial',
      url: 'https://kanjipath.local',
      license: 'CC BY-SA 4.0',
      attributionText: 'KanjiPath',
    },
    update: {},
  });
  const version = await prisma.contentVersion.upsert({
    where: { id: 'ver-imm-test' },
    create: {
      id: 'ver-imm-test',
      version: 'imm-test-1',
      publishedAt: new Date('2026-08-01T00:00:00Z'),
    },
    update: {},
  });

  await prisma.kanji.upsert({
    where: { id: 'k-imm-1' },
    create: {
      id: 'k-imm-1',
      literal: '亀',
      unicodeCodepoint: 'U+4E80',
      strokeCount: 11,
      status: 'published',
      contentVersionId: version.id,
      meanings: {
        create: {
          language: 'fr',
          meaning: 'tortue',
          isPrimary: true,
          sourceId: source.id,
          editorialStatus: 'published',
        },
      },
      readings: {
        create: [
          { reading: 'キ', romaji: 'ki', readingType: 'onyomi', sourceId: source.id },
          { reading: 'かめ', romaji: 'kame', readingType: 'kunyomi', sourceId: source.id },
        ],
      },
    },
    update: {},
  });

  await prisma.vocabulary.upsert({
    where: { id: 'v-imm-1' },
    create: {
      id: 'v-imm-1',
      writtenForm: '亀',
      reading: 'かめ',
      romaji: 'kame',
      meaningFr: 'tortue',
      partOfSpeech: 'nom',
      sourceId: source.id,
      editorialStatus: 'published',
    },
    update: { editorialStatus: 'published' },
  });
  await prisma.vocabularyKanji.deleteMany({ where: { vocabularyId: 'v-imm-1' } });
  await prisma.vocabularyKanji.create({
    data: { vocabularyId: 'v-imm-1', kanjiId: 'k-imm-1', position: 0, readingInWord: 'かめ' },
  });

  const meaningTemplate = await prisma.exerciseTemplate.upsert({
    where: { id: 'tpl-kanji_to_meaning_qcm' },
    create: {
      id: 'tpl-kanji_to_meaning_qcm',
      type: 'kanji_to_meaning_qcm',
      skill: 'meaning',
      schemaVersion: 1,
      renderer: 'qcm',
      grader: 'exact-match',
    },
    update: {},
  });
  const readingTemplate = await prisma.exerciseTemplate.upsert({
    where: { id: 'tpl-vocab_reading_qcm' },
    create: {
      id: 'tpl-vocab_reading_qcm',
      type: 'vocab_reading_qcm',
      skill: 'vocabulary',
      schemaVersion: 1,
      renderer: 'qcm',
      grader: 'exact-match',
    },
    update: {},
  });

  await prisma.exerciseItem.upsert({
    where: { externalId: 'x-imm-meaning' },
    create: {
      externalId: 'x-imm-meaning',
      templateId: meaningTemplate.id,
      level: 'N4',
      skill: 'meaning',
      kanjiId: 'k-imm-1',
      promptJson: { kanji: '亀', instruction: 'Quel est le sens principal de ce kanji ?' },
      answerJson: { acceptedAnswers: ['tortue'], distractors: ['dragon', 'grue', 'carpe'] },
      explanationJson: { explanation: '亀 signifie « tortue ».' },
      difficulty: 1,
      sourceId: source.id,
      contentVersionId: version.id,
      editorialStatus: 'published',
    },
    update: { level: 'N4', editorialStatus: 'published' },
  });
  await prisma.exerciseItem.upsert({
    where: { externalId: 'x-imm-reading' },
    create: {
      externalId: 'x-imm-reading',
      templateId: readingTemplate.id,
      level: 'N4',
      skill: 'vocabulary',
      kanjiId: 'k-imm-1',
      vocabularyId: 'v-imm-1',
      promptJson: { word: '亀', instruction: 'Quelle est la lecture de ce mot ?' },
      answerJson: { acceptedAnswers: ['かめ'], distractors: ['き', 'いぬ', 'うま'] },
      explanationJson: { explanation: '亀 se lit かめ.' },
      difficulty: 2,
      sourceId: source.id,
      contentVersionId: version.id,
      editorialStatus: 'published',
    },
    update: { level: 'N4', editorialStatus: 'published' },
  });
}
