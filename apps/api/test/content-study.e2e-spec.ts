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

describeWithDb('contenu + étude + progression (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const email = `study-${Date.now()}@example.com`;
  const password = 'mot-de-passe-e2e';
  let sessionCookie = '';
  let csrfToken = '';

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

  it('inscrit un utilisateur', async () => {
    await fetchCsrf();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password, displayName: 'Étude E2E' },
    });
    expect(response.statusCode).toBe(201);
    sessionCookie = `kp_session=${findCookie(response, 'kp_session')?.value}`;
  });

  it('liste les kanji du niveau N5', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji?level=N5',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.level).toBe('N5');
    expect(body.kanji.length).toBeGreaterThanOrEqual(2);
    expect(body.kanji[0].literal).toBe('一');
  });

  it('retourne la fiche détaillée du kanji 一', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji/一',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.literal).toBe('一');
    expect(body.meanings.length).toBeGreaterThan(0);
    expect(body.readings.length).toBeGreaterThan(0);
  });

  it('retourne une 404 pour un kanji inconnu', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji/龘',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(404);
  });

  it('liste les sources de contenu', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sources',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.sources[0].license).toBeTruthy();
  });

  let exerciseItemId = '';
  let reviewedLiteral = '';

  it("crée une session d'étude", async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'daily' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.session.id).toBeTruthy();
    expect(body.items.length).toBeGreaterThan(0);
    exerciseItemId = body.items[0].exerciseItemId;
    reviewedLiteral = body.items[0].kanjiLiteral;
    expect(reviewedLiteral).toBeTruthy();
  });

  it('répond correctement à un exercice', async () => {
    const queue = await app.inject({
      method: 'GET',
      url: '/api/v1/study/resume',
      headers: { cookie: sessionCookie },
    });
    const item = queue
      .json()
      .items.find((entry: { exerciseItemId: string }) => entry.exerciseItemId === exerciseItemId);
    expect(item).toBeTruthy();

    const exercise = await prisma.exerciseItem.findUnique({ where: { id: exerciseItemId } });
    const answerJson = exercise?.answerJson as { acceptedAnswers?: string[] };
    const accepted = answerJson?.acceptedAnswers?.[0] ?? '';

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/answers',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { exerciseItemId, answer: accepted, responseTimeMs: 1200 },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.correct).toBe(true);
    expect(body.nextDueAt).toBeTruthy();
  });

  it('refuse une réponse sans session active', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/answers',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { exerciseItemId: 'inexistant', answer: 'x' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('affiche le tableau de bord de progression', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/dashboard',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.activeLevel).toBe('N5');
    expect(body.levels.length).toBe(5);
    expect(body.reviewsToday).toBeGreaterThanOrEqual(1);
  });

  it('affiche la progression du niveau N5', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/levels/N5',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.level).toBe('N5');
    expect(body.kanji.length).toBeGreaterThanOrEqual(2);
    const reviewed = body.kanji.find((k: { literal: string }) => k.literal === reviewedLiteral);
    expect(reviewed).toBeTruthy();
    expect(reviewed.overallScore).toBeGreaterThan(0);
  });

  it('termine la session', async () => {
    const resume = await app.inject({
      method: 'GET',
      url: '/api/v1/study/resume',
      headers: { cookie: sessionCookie },
    });
    const sessionId = resume.json().session?.id;
    expect(sessionId).toBeTruthy();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/study/sessions/${sessionId}/finish`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(response.statusCode).toBe(204);
  });
});

async function seedContent(prisma: PrismaService): Promise<void> {
  const source = await prisma.contentSource.upsert({
    where: { id: 'kanjidic2' },
    create: {
      id: 'kanjidic2',
      name: 'KANJIDIC2',
      url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
      license: 'CC BY-SA 4.0',
      attributionText: 'EDRDG',
    },
    update: {},
  });
  const version = await prisma.contentVersion.upsert({
    where: { id: 'ver-test' },
    create: { id: 'ver-test', version: 'test-1' },
    update: {},
  });

  const kanjiDefs = [
    {
      id: 'k-04e00',
      literal: '一',
      codepoint: 'U+4E00',
      strokes: 1,
      meaning: 'un',
      on: 'イチ',
      kun: 'ひと',
    },
    {
      id: 'k-04e8c',
      literal: '二',
      codepoint: 'U+4E8C',
      strokes: 2,
      meaning: 'deux',
      on: 'ニ',
      kun: 'ふた',
    },
  ];
  for (const def of kanjiDefs) {
    await prisma.kanji.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        literal: def.literal,
        unicodeCodepoint: def.codepoint,
        strokeCount: def.strokes,
        status: 'published',
        contentVersionId: version.id,
        meanings: {
          create: {
            language: 'fr',
            meaning: def.meaning,
            isPrimary: true,
            sourceId: source.id,
            editorialStatus: 'published',
          },
        },
        readings: {
          create: [
            { reading: def.on, readingType: 'onyomi', sourceId: source.id },
            { reading: def.kun, readingType: 'kunyomi', sourceId: source.id },
          ],
        },
      },
      update: {},
    });
  }

  const curriculum = await prisma.curriculum.upsert({
    where: { id: 'curr-JLPT_ALIGNED' },
    create: {
      id: 'curr-JLPT_ALIGNED',
      code: 'JLPT_ALIGNED',
      name: 'Parcours aligné sur le JLPT',
      version: 'test-1',
      status: 'published',
      publishedAt: new Date(),
    },
    update: { status: 'published' },
  });
  await prisma.curriculumKanji.deleteMany({ where: { curriculumId: curriculum.id } });
  await prisma.curriculumKanji.createMany({
    data: [
      {
        curriculumId: curriculum.id,
        kanjiId: 'k-04e00',
        level: 'N5',
        order: 1,
        confidence: 'high',
      },
      {
        curriculumId: curriculum.id,
        kanjiId: 'k-04e8c',
        level: 'N5',
        order: 2,
        confidence: 'high',
      },
    ],
  });

  const template = await prisma.exerciseTemplate.upsert({
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

  const exercises = [
    {
      id: 'x-test-1',
      kanjiId: 'k-04e00',
      prompt: { kanji: '一', instruction: 'Quel est le sens principal de ce kanji ?' },
      answers: { acceptedAnswers: ['un'], distractors: ['deux', 'trois', 'dix'] },
      explanation: '一 signifie « un ».',
    },
    {
      id: 'x-test-2',
      kanjiId: 'k-04e8c',
      prompt: { kanji: '二', instruction: 'Quel est le sens principal de ce kanji ?' },
      answers: { acceptedAnswers: ['deux'], distractors: ['un', 'trois', 'dix'] },
      explanation: '二 signifie « deux ».',
    },
  ];
  for (const exercise of exercises) {
    await prisma.exerciseItem.upsert({
      where: { externalId: exercise.id },
      create: {
        externalId: exercise.id,
        templateId: template.id,
        level: 'N5',
        skill: 'meaning',
        kanjiId: exercise.kanjiId,
        promptJson: exercise.prompt,
        answerJson: exercise.answers,
        explanationJson: { explanation: exercise.explanation },
        difficulty: 1,
        sourceId: source.id,
        contentVersionId: version.id,
        editorialStatus: 'published',
      },
      update: {},
    });
  }
}
