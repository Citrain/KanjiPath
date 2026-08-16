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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Utilisateur de test introuvable');
    }
    await prisma.userKanjiProgress.upsert({
      where: { userId_kanjiId: { userId: user.id, kanjiId: 'k-04e8c' } },
      create: { userId: user.id, kanjiId: 'k-04e8c', status: 'learning', overallScore: 0.5 },
      update: { status: 'learning', overallScore: 0.5 },
    });
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
    expect(body.kanji.find((item: { literal: string }) => item.literal === '一')?.hasAudio).toBe(
      true,
    );
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
    const onReading = body.readings.find((r: { reading: string }) => r.reading === 'イチ');
    expect(onReading?.romaji).toBe('ichi');
  });

  it('retourne une carte bornée de relations publiées avec provenance et progression', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji/一/map',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.nodes.length).toBeLessThanOrEqual(body.limit);
    expect(body.nodes.find((node: { literal: string }) => node.literal === '一')).toBeTruthy();
    expect(body.nodes.find((node: { literal: string }) => node.literal === '仮')).toBeUndefined();
    const two = body.nodes.find((node: { literal: string }) => node.literal === '二');
    expect(two).toMatchObject({ status: 'learning', overallScore: 0.5 });
    expect(body.links.map((link: { type: string }) => link.type)).toEqual(
      expect.arrayContaining([
        'shared_component',
        'visual_confusion',
        'shared_word',
        'curriculum_neighbor',
      ]),
    );
    for (const link of body.links) {
      expect(link.sourceId).toBe(body.centerId);
      expect(link.targetId).not.toBe(body.centerId);
      expect(link.provenance.sourceId).toBeTruthy();
      expect(link.provenance.contentVersion).toBe('test-1');
    }
  });

  it('retourne les phrases audio en priorité avec leurs tokens annotés', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji/一/sentences',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sentences.length).toBeGreaterThan(0);
    const sentence = body.sentences[0];
    expect(sentence.tokens.length).toBeGreaterThan(0);
    const kanjiToken = sentence.tokens.find((t: { surface: string }) => t.surface === '一');
    expect(kanjiToken?.reading).toBe('ひと');
    expect(kanjiToken?.romaji).toBe('hito');
    expect(sentence.audio?.url).toBe('/audio/a-test-1');
  });

  it('retourne chaque mot une seule fois, même si le kanji y apparaît plusieurs fois', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji/一/vocabulary',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(
      body.vocabulary.filter((word: { id: string }) => word.id === 'v-test-duplicate'),
    ).toHaveLength(1);
  });

  it('retourne une 404 pour un kanji inconnu', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji/龘',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(404);
  });

  it('recherche un mot par forme exacte (lecture en contexte)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/words/一つ',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.surface).toBe('一つ');
    expect(body.vocabulary.length).toBeGreaterThan(0);
    expect(body.vocabulary[0].writtenForm).toBe('一つ');
    expect(body.vocabulary[0].reading).toBe('ひとつ');
    expect(body.kanji.some((k: { literal: string }) => k.literal === '一')).toBe(true);
    const kanjiUn = body.kanji.find((k: { literal: string }) => k.literal === '一');
    expect(kanjiUn.primaryMeaning).toBe('un');
    expect(kanjiUn.readings.length).toBeGreaterThan(0);
    expect(kanjiUn.readings.some((r: { type: string }) => r.type === 'onyomi')).toBe(true);
  });

  it('recherche un mot par inclusion pour un token plus court', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/words/一',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.vocabulary.some((v: { writtenForm: string }) => v.writtenForm === '一つ')).toBe(
      true,
    );
  });

  it('rejette une surface vide ou trop longue pour la recherche de mot', async () => {
    const tooLong = '一二三四五六七八九十一二三';
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/words/${tooLong}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(400);
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

  it('liste les mini-textes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/texts',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.texts.length).toBeGreaterThan(0);
    const text = body.texts.find((t: { id: string }) => t.id === 't-test-1');
    expect(text?.title).toBe('一つ');
    expect(text?.level).toBe('N5');
  });

  it('filtre les mini-textes par niveau', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/texts?level=N5',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.level).toBe('N5');
    expect(body.texts.every((t: { level: string }) => t.level === 'N5')).toBe(true);
  });

  it('rejette un niveau de mini-textes invalide', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/texts?level=N9',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(400);
  });

  it("retourne le détail d'un mini-texte avec tokens", async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/texts/t-test-1',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.title).toBe('一つ');
    expect(body.translationFr).toBeTruthy();
    expect(body.tokens.length).toBeGreaterThan(0);
    const kanjiToken = body.tokens.find((t: { surface: string }) => t.surface === '一');
    expect(kanjiToken?.reading).toBe('ひと');
    expect(kanjiToken?.romaji).toBe('hito');
  });

  it('retourne une 404 pour un mini-texte inconnu', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/texts/t-inexistant',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(404);
  });

  it('met à jour la charge et la saisie kana dans les préférences', async () => {
    await fetchCsrf();
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { reviewLimit: 25, autoBalance: false, kanaInputEnabled: false },
    });
    expect(patch.statusCode).toBe(200);
    const updated = patch.json();
    expect(updated.reviewLimit).toBe(25);
    expect(updated.autoBalance).toBe(false);
    expect(updated.kanaInputEnabled).toBe(false);

    const invalid = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { reviewLimit: 3 },
    });
    expect(invalid.statusCode).toBe(400);
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
    expect(body.readings.length).toBeGreaterThan(0);
    expect(body.readings[0].reading).toBeTruthy();
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

  it('renvoie les statistiques détaillées', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/stats',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.totals.reviews).toBeGreaterThanOrEqual(1);
    expect(body.totals.sessionsCompleted).toBeGreaterThanOrEqual(1);
    expect(body.windows.last7Days.answered).toBeGreaterThanOrEqual(1);
    expect(body.windows.last30Days.accuracy).toBeGreaterThanOrEqual(0);
    expect(body.bySkill).toHaveLength(5);
    const meaning = body.bySkill.find((entry: { skill: string }) => entry.skill === 'meaning');
    expect(meaning?.answered).toBeGreaterThanOrEqual(1);
    expect(body.byLevel[0].level).toBe('N5');
    expect(body.forecast).toHaveLength(7);
    expect(typeof body.estimatedRetention).toBe('number');
  });

  it('marque un kanji comme connu et suspend ses cartes de révision', async () => {
    await fetchCsrf();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/kanji/${encodeURIComponent(reviewedLiteral)}/known`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('mastered');
    expect(body.overallScore).toBe(1);
    expect(body.scores).toEqual({
      meaning: 1,
      reading: 1,
      vocabulary: 1,
      context: 1,
      stroke: 1,
      listening: 1,
    });
    expect(body.cards.every((card: { state: string }) => card.state === 'Suspended')).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/kanji?level=N5',
      headers: { cookie: sessionCookie },
    });
    const known = list
      .json()
      .kanji.find((item: { literal: string }) => item.literal === reviewedLiteral);
    expect(known.status).toBe('mastered');
    expect(known.nextDueAt).toBeNull();
  });

  it('restaure l’état FSRS suspendu pendant une révision ciblée', async () => {
    const exercise = await prisma.exerciseItem.findUnique({
      where: { id: exerciseItemId },
      include: { kanji: true },
    });
    if (!exercise?.kanji) {
      throw new Error('Exercice de test introuvable');
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const card = await prisma.reviewCard.findFirst({
      where: { userId: user.id, subjectId: exercise.kanji.id },
    });
    if (!card) {
      throw new Error('Carte de révision suspendue introuvable');
    }
    expect(card.state).toBe('Suspended');
    expect(card.stateBeforeSuspension).not.toBeNull();

    const session = await prisma.studySession.create({
      data: {
        userId: card.userId,
        mode: 'targeted',
        items: { create: { position: 0, exerciseItemId } },
      },
    });
    const accepted =
      (exercise.answerJson as { acceptedAnswers?: string[] }).acceptedAnswers?.[0] ?? '';
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/answers',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { sessionId: session.id, exerciseItemId, answer: accepted },
    });
    expect(response.statusCode).toBe(201);
    const resumed = await prisma.reviewCard.findUniqueOrThrow({ where: { id: card.id } });
    expect(resumed.state).not.toBe('Suspended');
    expect(resumed.stateBeforeSuspension).toBeNull();
  });

  it('refuse une session ciblée sans filtre', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'targeted' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuse une session ciblée avec un filtre vide', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'targeted', target: {} },
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuse une session ciblée sans exercice correspondant', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'targeted', target: { skill: 'reading' } },
    });
    expect(response.statusCode).toBe(400);
  });

  it('crée une session ciblée par niveau', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'targeted', target: { level: 'N5' } },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.session.mode).toBe('targeted');
    expect(body.session.target).toEqual({ level: 'N5' });
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.skill).toBe('meaning');
    }
  });

  it('crée une session ciblée sur un kanji précis', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'targeted', target: { kanjiIds: ['k-04e00'] } },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.kanjiLiteral).toBe('一');
    }
  });

  it('abandonne une session et marque les items restants comme ignorés', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/study/sessions',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { mode: 'targeted', target: { level: 'N5' } },
    });
    const sessionId = created.json().session.id;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/study/sessions/${sessionId}/abandon`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(response.statusCode).toBe(204);
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: { items: true },
    });
    expect(session?.endedAt).not.toBeNull();
    expect(session?.items.every((item) => item.status !== 'pending')).toBe(true);
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
      onRomaji: 'ichi',
      kun: 'ひと',
      kunRomaji: 'hito',
    },
    {
      id: 'k-04e8c',
      literal: '二',
      codepoint: 'U+4E8C',
      strokes: 2,
      meaning: 'deux',
      on: 'ニ',
      onRomaji: 'ni',
      kun: 'ふた',
      kunRomaji: 'futa',
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
            { reading: def.on, romaji: def.onRomaji, readingType: 'onyomi', sourceId: source.id },
            {
              reading: def.kun,
              romaji: def.kunRomaji,
              readingType: 'kunyomi',
              sourceId: source.id,
            },
          ],
        },
      },
      update: {},
    });
    await prisma.kanjiReading.deleteMany({ where: { kanjiId: def.id } });
    await prisma.kanjiReading.createMany({
      data: [
        {
          kanjiId: def.id,
          reading: def.on,
          romaji: def.onRomaji,
          readingType: 'onyomi',
          sourceId: source.id,
        },
        {
          kanjiId: def.id,
          reading: def.kun,
          romaji: def.kunRomaji,
          readingType: 'kunyomi',
          sourceId: source.id,
        },
      ],
    });
  }
  await prisma.kanji.upsert({
    where: { id: 'k-unpublished' },
    create: {
      id: 'k-unpublished',
      literal: '仮',
      unicodeCodepoint: 'U+4EEE',
      strokeCount: 6,
      status: 'draft',
      contentVersionId: version.id,
    },
    update: { status: 'draft' },
  });

  await prisma.sentence.upsert({
    where: { id: 's-before-audio' },
    create: {
      id: 's-before-audio',
      japanese: '一。',
      translationFr: 'Un.',
      difficulty: 'N5',
      sourceId: source.id,
      author: 'KanjiPath',
      license: 'CC BY-SA 4.0',
      editorialStatus: 'published',
    },
    update: {
      japanese: '一。',
      translationFr: 'Un.',
    },
  });
  await prisma.sentence.upsert({
    where: { id: 's-test-1' },
    create: {
      id: 's-test-1',
      japanese: '一つです。',
      translationFr: "C'en est un.",
      difficulty: 'N5',
      sourceId: source.id,
      author: 'KanjiPath',
      license: 'CC BY-SA 4.0',
      editorialStatus: 'published',
    },
    update: {
      japanese: '一つです。',
      translationFr: "C'en est un.",
    },
  });
  await prisma.sentenceToken.deleteMany({ where: { sentenceId: 's-test-1' } });
  await prisma.sentenceToken.createMany({
    data: [
      {
        sentenceId: 's-test-1',
        surface: '一',
        reading: 'ひと',
        romaji: 'hito',
        startOffset: 0,
        endOffset: 1,
      },
      {
        sentenceId: 's-test-1',
        surface: 'つ',
        reading: 'つ',
        romaji: 'tsu',
        startOffset: 1,
        endOffset: 2,
      },
      {
        sentenceId: 's-test-1',
        surface: 'です',
        reading: 'です',
        romaji: 'desu',
        startOffset: 2,
        endOffset: 4,
      },
      { sentenceId: 's-test-1', surface: '。', reading: '。', startOffset: 4, endOffset: 5 },
    ],
  });

  await prisma.vocabulary.upsert({
    where: { id: 'v-test-1' },
    create: {
      id: 'v-test-1',
      writtenForm: '一つ',
      reading: 'ひとつ',
      romaji: 'hitotsu',
      meaningFr: 'un ; un seul',
      partOfSpeech: 'nom',
      sourceId: source.id,
      editorialStatus: 'published',
    },
    update: { editorialStatus: 'published' },
  });
  await prisma.vocabularyKanji.deleteMany({ where: { vocabularyId: 'v-test-1' } });
  await prisma.vocabularyKanji.create({
    data: { vocabularyId: 'v-test-1', kanjiId: 'k-04e00', position: 0, readingInWord: 'ひと' },
  });
  await prisma.vocabulary.upsert({
    where: { id: 'v-test-duplicate' },
    create: {
      id: 'v-test-duplicate',
      writtenForm: '一一',
      reading: 'いちいち',
      romaji: 'ichiichi',
      meaningFr: 'un par un',
      partOfSpeech: 'adverbe',
      sourceId: source.id,
      editorialStatus: 'published',
    },
    update: { editorialStatus: 'published' },
  });
  await prisma.vocabularyKanji.deleteMany({ where: { vocabularyId: 'v-test-duplicate' } });
  await prisma.vocabularyKanji.createMany({
    data: [
      { vocabularyId: 'v-test-duplicate', kanjiId: 'k-04e00', position: 0, readingInWord: 'いち' },
      { vocabularyId: 'v-test-duplicate', kanjiId: 'k-04e00', position: 1, readingInWord: 'いち' },
    ],
  });
  await prisma.audioResource.upsert({
    where: { id: 'a-test-1' },
    create: {
      id: 'a-test-1',
      vocabularyId: 'v-test-1',
      sentenceId: 's-test-1',
      sourceId: source.id,
      filePath: 'audio/a-test-1.mp3',
      mimeType: 'audio/mpeg',
      transcript: '一つです。',
      attributionText: 'Audio de test KanjiPath',
      license: 'CC BY-SA 4.0',
      checksum: 'sha256:test',
      editorialStatus: 'published',
    },
    update: { editorialStatus: 'published' },
  });

  await prisma.miniText.upsert({
    where: { id: 't-test-1' },
    create: {
      id: 't-test-1',
      title: '一つ',
      body: '一つです。',
      translationFr: "C'en est un.",
      level: 'N5',
      author: 'KanjiPath',
      license: 'CC BY-SA 4.0',
      sourceId: source.id,
      editorialStatus: 'published',
    },
    update: { editorialStatus: 'published' },
  });
  await prisma.miniTextToken.deleteMany({ where: { miniTextId: 't-test-1' } });
  await prisma.miniTextToken.createMany({
    data: [
      {
        miniTextId: 't-test-1',
        surface: '一',
        reading: 'ひと',
        romaji: 'hito',
        startOffset: 0,
        endOffset: 1,
      },
      {
        miniTextId: 't-test-1',
        surface: 'つ',
        reading: 'つ',
        romaji: 'tsu',
        startOffset: 1,
        endOffset: 2,
      },
      {
        miniTextId: 't-test-1',
        surface: 'です',
        reading: 'です',
        romaji: 'desu',
        startOffset: 2,
        endOffset: 4,
      },
      { miniTextId: 't-test-1', surface: '。', reading: '。', startOffset: 4, endOffset: 5 },
    ],
  });

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
  await prisma.component.upsert({
    where: { id: 'comp-test-shared' },
    create: { id: 'comp-test-shared', literal: '丶', componentType: 'shape' },
    update: {},
  });
  await prisma.kanjiComponent.upsert({
    where: { kanjiId_componentId: { kanjiId: 'k-04e00', componentId: 'comp-test-shared' } },
    create: {
      kanjiId: 'k-04e00',
      componentId: 'comp-test-shared',
      position: 0,
      sourceId: source.id,
    },
    update: { sourceId: source.id },
  });
  await prisma.kanjiComponent.upsert({
    where: { kanjiId_componentId: { kanjiId: 'k-unpublished', componentId: 'comp-test-shared' } },
    create: {
      kanjiId: 'k-unpublished',
      componentId: 'comp-test-shared',
      position: 0,
      sourceId: source.id,
    },
    update: { sourceId: source.id },
  });
  await prisma.kanjiComponent.upsert({
    where: { kanjiId_componentId: { kanjiId: 'k-04e8c', componentId: 'comp-test-shared' } },
    create: {
      kanjiId: 'k-04e8c',
      componentId: 'comp-test-shared',
      position: 0,
      sourceId: source.id,
    },
    update: { sourceId: source.id },
  });
  await prisma.kanjiNotes.upsert({
    where: { kanjiId: 'k-04e00' },
    create: {
      kanjiId: 'k-04e00',
      confusions: ['二'],
      editorialStatus: 'published',
    },
    update: { confusions: ['二'], editorialStatus: 'published' },
  });
  await prisma.vocabulary.upsert({
    where: { id: 'v-test-shared' },
    create: {
      id: 'v-test-shared',
      writtenForm: '一二',
      reading: 'いちに',
      meaningFr: 'un, deux',
      sourceId: source.id,
      editorialStatus: 'published',
    },
    update: { editorialStatus: 'published' },
  });
  await prisma.vocabularyKanji.deleteMany({ where: { vocabularyId: 'v-test-shared' } });
  await prisma.vocabularyKanji.createMany({
    data: [
      { vocabularyId: 'v-test-shared', kanjiId: 'k-04e00', position: 0, readingInWord: 'いち' },
      { vocabularyId: 'v-test-shared', kanjiId: 'k-04e8c', position: 1, readingInWord: 'に' },
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
