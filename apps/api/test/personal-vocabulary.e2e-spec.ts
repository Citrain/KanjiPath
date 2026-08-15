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
}

function findCookie(response: { cookies: ParsedCookie[] }, name: string): ParsedCookie | undefined {
  return response.cookies.find((entry) => entry.name === name);
}

describeWithDb('carnet de vocabulaire personnel (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let vocabularyId = '';
  let textId = '';
  let tokenId = '';
  let turnId = '';
  let firstUserId = '';
  let firstSessionCookie = '';
  let firstCsrf = '';
  let secondSessionCookie = '';
  let secondCsrf = '';
  let publishedEntryId = '';
  let conversationEntryId = '';

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

    const suffix = `${Date.now()}`;
    const source = await prisma.contentSource.create({
      data: {
        name: `Carnet source ${suffix}`,
        url: 'https://example.test/source',
        license: 'CC BY 4.0',
        attributionText: 'Attribution de test',
        sourceVersion: 'source-test-1',
      },
    });
    await prisma.contentVersion.create({ data: { version: `carnet-${suffix}` } });
    vocabularyId = `v-carnet-${suffix}`;
    textId = `t-carnet-${suffix}`;
    tokenId = `mt-carnet-${suffix}`;
    await prisma.vocabulary.create({
      data: {
        id: vocabularyId,
        writtenForm: '食べる',
        reading: 'たべる',
        meaningFr: 'manger',
        sourceId: source.id,
        editorialStatus: 'published',
      },
    });
    await prisma.miniText.create({
      data: {
        id: textId,
        title: 'Déjeuner',
        body: '私はパンを食べる。',
        translationFr: 'Je mange du pain.',
        author: 'Auteur de test',
        license: 'CC BY 4.0',
        sourceId: source.id,
        editorialStatus: 'published',
        tokens: {
          create: {
            id: tokenId,
            surface: '食べる',
            reading: 'たべる',
            startOffset: 5,
            endOffset: 8,
          },
        },
      },
    });

    const first = await register(`carnet-first-${suffix}@example.com`, 'Premier');
    firstUserId = first.userId;
    firstSessionCookie = first.sessionCookie;
    firstCsrf = first.csrf;
    const second = await register(`carnet-second-${suffix}@example.com`, 'Second');
    secondSessionCookie = second.sessionCookie;
    secondCsrf = second.csrf;
    const conversation = await prisma.conversationSession.create({
      data: {
        userId: firstUserId,
        level: 'N5',
        scenario: 'free',
        difficulty: 'easy',
        correctionMode: 'important',
        japaneseSpeechSpeed: 'normal',
        goalsJson: [],
      },
    });
    const turn = await prisma.conversationTurn.create({
      data: {
        sessionId: conversation.id,
        position: 0,
        transcript: 'パンを食べる。',
        replyJson: { ja: 'いいですね。', reading: 'いいですね。' },
        contextJson: {},
      },
    });
    turnId = turn.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(email: string, displayName: string) {
    const csrfResponse = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    const csrf = findCookie(csrfResponse, 'kp_csrf')?.value ?? '';
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrf },
      headers: { 'x-csrf-token': csrf },
      payload: { email, password: 'mot-de-passe-e2e', displayName },
    });
    const sessionCookie = `kp_session=${findCookie(response, 'kp_session')?.value ?? ''}`;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Utilisateur de test introuvable');
    return { csrf, sessionCookie, userId: user.id };
  }

  function auth(sessionCookie: string, csrf: string) {
    return {
      cookies: { kp_csrf: csrf },
      headers: { cookie: `${sessionCookie}; kp_csrf=${csrf}`, 'x-csrf-token': csrf },
    };
  }

  it('fige la provenance, version et attribution d’un mot publié', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/personal-vocabulary',
      ...auth(firstSessionCookie, firstCsrf),
      payload: { origin: 'published', vocabularyId, textId, tokenId },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    publishedEntryId = body.id;
    expect(body).toMatchObject({ surface: '食べる', reading: 'たべる', meaningFr: 'manger' });
    expect(body.source).toMatchObject({
      origin: 'published_text',
      reference: `text:${textId}:token:${tokenId}:vocabulary:${vocabularyId}`,
      sourceVersion: 'source-test-1',
      attributionText: 'Auteur de test',
      license: 'CC BY 4.0',
    });
    expect(body.source.contentVersion).toMatch(/^carnet-/);
  });

  it('déduplique la même provenance publiée', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/personal-vocabulary',
      ...auth(firstSessionCookie, firstCsrf),
      payload: { origin: 'published', vocabularyId, textId, tokenId },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().id).toBe(publishedEntryId);
    expect(await prisma.personalVocabularyEntry.count({ where: { userId: firstUserId } })).toBe(1);
  });

  it('conserve un mot de conversation du seul propriétaire', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/personal-vocabulary',
      ...auth(firstSessionCookie, firstCsrf),
      payload: {
        origin: 'conversation',
        conversationTurnId: turnId,
        surface: '食べる',
        reading: 'たべる',
        meaningFr: 'manger',
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    conversationEntryId = body.id;
    expect(body.source).toMatchObject({
      origin: 'conversation',
      reference: `conversation_turn:${turnId}`,
    });
    expect(JSON.stringify(body.source)).not.toContain('パンを食べる。');

    const otherList = await app.inject({
      method: 'GET',
      url: '/api/v1/personal-vocabulary',
      headers: { cookie: secondSessionCookie },
    });
    expect(otherList.statusCode).toBe(200);
    expect(otherList.json().entries).toEqual([]);
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/v1/personal-vocabulary',
      ...auth(secondSessionCookie, secondCsrf),
      payload: { origin: 'conversation', conversationTurnId: turnId, surface: '食べる' },
    });
    expect(forbidden.statusCode).toBe(404);
  });

  it('archive sans effacer et exclut les cartes des nouvelles sessions', async () => {
    const archived = await app.inject({
      method: 'POST',
      url: `/api/v1/personal-vocabulary/${publishedEntryId}/archive`,
      ...auth(firstSessionCookie, firstCsrf),
    });
    expect(archived.statusCode).toBe(201);
    expect(archived.json().archivedAt).toBeTruthy();
    const active = await app.inject({
      method: 'GET',
      url: '/api/v1/personal-vocabulary',
      headers: { cookie: firstSessionCookie },
    });
    expect(active.json().entries.map((entry: { id: string }) => entry.id)).toEqual([
      conversationEntryId,
    ]);
    const archivedList = await app.inject({
      method: 'GET',
      url: '/api/v1/personal-vocabulary?archived=true',
      headers: { cookie: firstSessionCookie },
    });
    expect(archivedList.json().entries.map((entry: { id: string }) => entry.id)).toEqual([
      publishedEntryId,
    ]);
  });

  it('planifie une révision du carnet sans créer de progression kanji', async () => {
    const before = await Promise.all([
      prisma.reviewCard.count({ where: { userId: firstUserId } }),
      prisma.userKanjiProgress.count({ where: { userId: firstUserId } }),
    ]);
    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/personal-vocabulary/sessions',
      ...auth(firstSessionCookie, firstCsrf),
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const firstItem = session.items[0] as { sessionItemId: string; kind: string };
    const answer = await app.inject({
      method: 'POST',
      url: '/api/v1/personal-vocabulary/answers',
      ...auth(firstSessionCookie, firstCsrf),
      payload:
        firstItem.kind === 'reading'
          ? {
              sessionId: session.session.id,
              sessionItemId: firstItem.sessionItemId,
              answer: 'たべる',
            }
          : {
              sessionId: session.session.id,
              sessionItemId: firstItem.sessionItemId,
              rating: 'good',
            },
    });
    expect(answer.statusCode).toBe(201);
    expect(await prisma.personalVocabularyReviewLog.count()).toBe(1);
    expect(await prisma.reviewCard.count({ where: { userId: firstUserId } })).toBe(before[0]);
    expect(await prisma.userKanjiProgress.count({ where: { userId: firstUserId } })).toBe(
      before[1],
    );
  });

  it('supprime explicitement les cartes et journaux personnels associés', async () => {
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/personal-vocabulary/${conversationEntryId}`,
      ...auth(firstSessionCookie, firstCsrf),
    });
    expect(removed.statusCode).toBe(204);
    expect(
      await prisma.personalVocabularyEntry.findUnique({ where: { id: conversationEntryId } }),
    ).toBeNull();
    expect(
      await prisma.personalVocabularyReviewCard.count({
        where: { entry: { userId: firstUserId } },
      }),
    ).toBe(2);
    expect(
      await prisma.personalVocabularyReviewLog.count({
        where: { reviewCard: { entry: { userId: firstUserId } } },
      }),
    ).toBe(0);
    expect(await prisma.conversationTurn.findUnique({ where: { id: turnId } })).not.toBeNull();
  });
});
