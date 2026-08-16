import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { csrfCookiePlugin } from '../src/infrastructure/security/csrf-cookie.plugin';
import {
  JAPANESE_TTS_PROVIDER,
  type JapaneseTtsProvider,
  LLM_PROVIDER,
  type LlmProvider,
  type SpeechToTextProvider,
  STT_PROVIDER,
} from '../src/modules/conversation/conversation.providers';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST ?? '';
const describeWithDb = DATABASE_URL_TEST.length > 0 ? describe : describe.skip;

interface ParsedCookie {
  name: string;
  value: string;
}

function cookieValue(response: { cookies: ParsedCookie[] }, name: string): string {
  return response.cookies.find((entry) => entry.name === name)?.value ?? '';
}

const SENTENCE_WITH_AUDIO_ID = 's-shadowing-e2e-audio';
const SENTENCE_TTS_ONLY_ID = 's-shadowing-e2e-tts';
const AUDIO_RESOURCE_ID = 'aud-shadowing-e2e';
const RUN_ID = Date.now();

describeWithDb('shadowing (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let csrfToken = '';
  let sessionCookie = '';
  let userId = '';
  let otherSessionCookie = '';
  let otherCsrf = '';
  const sttState = { available: true, fail: false, transcript: 'わたしはがくせいです' };

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL_TEST;
    process.env.LOCAL_AI_ENABLED = 'false';
    const llm: LlmProvider = {
      health: async () => ({ available: false, detail: null }),
      generate: async () => '',
    };
    const japaneseTts: JapaneseTtsProvider = {
      health: async () => ({ available: true, detail: null }),
      voices: async () => [],
      synthesize: async () => ({ mimeType: 'audio/wav', bytes: Buffer.from('RIFF') }),
    };
    const stt: SpeechToTextProvider = {
      health: async () =>
        sttState.available
          ? { available: true, detail: null }
          : { available: false, detail: 'STT est indisponible' },
      transcribe: async () => {
        if (sttState.fail) throw new Error('STT en échec');
        return sttState.transcript;
      },
      startLive: async () => ({
        write: () => undefined,
        finish: async () => '',
        close: () => undefined,
      }),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER)
      .useValue(llm)
      .overrideProvider(JAPANESE_TTS_PROVIDER)
      .useValue(japaneseTts)
      .overrideProvider(STT_PROVIDER)
      .useValue(stt)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(cookie);
    await app.register(csrfCookiePlugin);
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);

    const source = await prisma.contentSource.create({
      data: {
        name: `shadowing-e2e-${RUN_ID}`,
        url: 'https://example.com',
        license: 'CC BY 4.0',
      },
    });
    await prisma.sentence.create({
      data: {
        id: SENTENCE_WITH_AUDIO_ID,
        japanese: 'わたしは学生です',
        translationFr: 'Je suis étudiant.',
        difficulty: 'N5',
        editorialStatus: 'published',
        author: 'Auteure E2E',
        license: 'CC BY 2.0 FR',
        sourceId: source.id,
        tokens: {
          create: [
            {
              surface: 'わたし',
              reading: 'わたし',
              romaji: 'watashi',
              startOffset: 0,
              endOffset: 3,
            },
            { surface: 'は', reading: 'は', romaji: 'wa', startOffset: 3, endOffset: 4 },
            {
              surface: '学生',
              reading: 'がくせい',
              romaji: 'gakusei',
              startOffset: 4,
              endOffset: 6,
            },
            { surface: 'です', reading: 'です', romaji: 'desu', startOffset: 6, endOffset: 8 },
          ],
        },
        audioResources: {
          create: {
            id: AUDIO_RESOURCE_ID,
            sourceId: source.id,
            filePath: `audio/shadowing-e2e-${RUN_ID}.mp3`,
            mimeType: 'audio/mpeg',
            transcript: 'わたしは学生です',
            attributionText: 'Clip E2E — Auteure E2E',
            license: 'CC BY 4.0',
            checksum: 'sha256-e2e',
            editorialStatus: 'published',
          },
        },
      },
    });
    await prisma.sentence.create({
      data: {
        id: SENTENCE_TTS_ONLY_ID,
        japanese: 'こんにちは',
        translationFr: 'Bonjour.',
        difficulty: 'N5',
        editorialStatus: 'published',
        sourceId: source.id,
        tokens: {
          create: [
            {
              surface: 'こんにちは',
              reading: 'こんにちは',
              romaji: 'konnichiwa',
              startOffset: 0,
              endOffset: 5,
            },
          ],
        },
      },
    });

    const csrf = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    csrfToken = cookieValue(csrf, 'kp_csrf');
    const registered = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        email: `shadowing-${RUN_ID}@example.com`,
        password: 'mot-de-passe-e2e',
        displayName: 'Shadowing E2E',
      },
    });
    sessionCookie = `kp_session=${cookieValue(registered, 'kp_session')}`;
    userId = (await prisma.user.findUnique({
      where: { email: `shadowing-${RUN_ID}@example.com` },
    }))!.id;

    const otherCsrfResponse = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    otherCsrf = cookieValue(otherCsrfResponse, 'kp_csrf');
    const other = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: otherCsrf },
      headers: { 'x-csrf-token': otherCsrf },
      payload: {
        email: `shadowing-other-${RUN_ID}@example.com`,
        password: 'mot-de-passe-e2e',
        displayName: 'Autre E2E',
      },
    });
    otherSessionCookie = `kp_session=${cookieValue(other, 'kp_session')}`;
  });

  afterAll(async () => {
    await prisma.sentence.deleteMany({
      where: { id: { in: [SENTENCE_WITH_AUDIO_ID, SENTENCE_TTS_ONLY_ID] } },
    });
    await prisma.contentSource.deleteMany({ where: { name: `shadowing-e2e-${RUN_ID}` } });
    await prisma.user.deleteMany({
      where: {
        email: { in: [`shadowing-${RUN_ID}@example.com`, `shadowing-other-${RUN_ID}@example.com`] },
      },
    });
    await app.close();
  });

  function authHeaders() {
    return {
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: `${sessionCookie}; kp_csrf=${csrfToken}`, 'x-csrf-token': csrfToken },
    };
  }

  it('exige une session authentifiée', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/shadowing/targets' });
    expect(response.statusCode).toBe(401);
  });

  it('liste des cibles audio publiées avec attribution et licence', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/shadowing/targets?level=N5&source=audio',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.level).toBe('N5');
    expect(body.source).toBe('audio');
    const target = body.targets.find(
      (entry: { id: string }) => entry.id === SENTENCE_WITH_AUDIO_ID,
    );
    expect(target).toBeDefined();
    expect(target.audio).toEqual({
      url: `/audio/${AUDIO_RESOURCE_ID}`,
      attribution: 'Clip E2E — Auteure E2E',
      license: 'CC BY 4.0',
    });
    expect(target.sentenceLicense).toBe('CC BY 2.0 FR');
    expect(target.reading).toBe('わたしはがくせいです');
    expect(target.tokens).toHaveLength(4);
  });

  it('liste des cibles TTS sans audio ni attribution inventée', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/shadowing/targets?level=N5&source=tts',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const target = body.targets.find((entry: { id: string }) => entry.id === SENTENCE_TTS_ONLY_ID);
    expect(target).toBeDefined();
    expect(target.audio).toBeNull();
    expect(body.targets.some((entry: { id: string }) => entry.id === SENTENCE_WITH_AUDIO_ID)).toBe(
      true,
    );
  });

  it('rejette un niveau invalide', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/shadowing/targets?level=N9',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(400);
  });

  it('relaye la synthèse TTS sans stockage', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/shadowing/targets/${SENTENCE_TTS_ONLY_ID}/tts?speed=slow`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ mimeType: 'audio/wav', base64: 'UklGRg==' });
  });

  it('transcrit en mémoire sans rien persister', async () => {
    const before = await prisma.shadowingResult.count({ where: { userId } });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/transcribe',
      ...authHeaders(),
      payload: {
        audioBase64: Buffer.alloc(32_000, 1).toString('base64'),
        encoding: 'pcm_s16le',
        sampleRate: 16_000,
        durationMs: 1_000,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ transcript: 'わたしはがくせいです' });
    expect(await prisma.shadowingResult.count({ where: { userId } })).toBe(before);
  });

  it('contrôle la taille et la durée des enregistrements', async () => {
    const tooLong = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/transcribe',
      ...authHeaders(),
      payload: {
        audioBase64: Buffer.alloc(32_000, 1).toString('base64'),
        encoding: 'pcm_s16le',
        sampleRate: 16_000,
        durationMs: 21_000,
      },
    });
    expect(tooLong.statusCode).toBe(400);
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/transcribe',
      ...authHeaders(),
      payload: {
        audioBase64: Buffer.alloc(700_000, 1).toString('base64'),
        encoding: 'pcm_s16le',
        sampleRate: 16_000,
        durationMs: 20_000,
      },
    });
    expect(rejected.statusCode).toBe(400);
    const tooLarge = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/transcribe',
      ...authHeaders(),
      payload: {
        audioBase64: Buffer.alloc(655_362, 1).toString('base64'),
        encoding: 'pcm_s16le',
        sampleRate: 16_000,
        durationMs: 20_000,
      },
    });
    expect(tooLarge.statusCode).toBe(413);
  });

  it('compare de façon déterministe sans note ni verdict de prononciation', async () => {
    const exact = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/compare',
      ...authHeaders(),
      payload: { sentenceId: SENTENCE_WITH_AUDIO_ID, transcript: 'わたしはがくせいです' },
    });
    expect(exact.statusCode).toBe(201);
    const exactBody = exact.json();
    expect(exactBody.matched).toBe(true);
    expect(exactBody.targetReading).toBe('わたしはがくせいです');
    expect(
      exactBody.segments.every((segment: { status: string }) => segment.status === 'matched'),
    ).toBe(true);
    expect(Object.keys(exactBody).sort()).toEqual(
      ['matched', 'segments', 'sentenceId', 'targetReading', 'transcript'].sort(),
    );
    for (const segment of exactBody.segments) {
      expect(Object.keys(segment).sort()).toEqual(
        ['reading', 'romaji', 'status', 'surface'].sort(),
      );
    }

    const partial = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/compare',
      ...authHeaders(),
      payload: { sentenceId: SENTENCE_WITH_AUDIO_ID, transcript: 'わたしはです' },
    });
    expect(partial.statusCode).toBe(201);
    const partialBody = partial.json();
    expect(partialBody.matched).toBe(false);
    const student = partialBody.segments.find(
      (segment: { surface: string }) => segment.surface === '学生',
    );
    expect(student.status).toBe('differs');
  });

  it('refuse une comparaison vers une phrase inconnue ou non publiée', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/compare',
      ...authHeaders(),
      payload: { sentenceId: 's-introuvable', transcript: 'こんにちは' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('n enregistre un résultat que sur opt-in explicite et le réserve à son utilisateur', async () => {
    expect(await prisma.shadowingResult.count()).toBe(0);
    const saved = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/results',
      ...authHeaders(),
      payload: {
        sentenceId: SENTENCE_WITH_AUDIO_ID,
        source: 'audio',
        transcript: 'わたしはがくせいです',
      },
    });
    expect(saved.statusCode).toBe(201);
    const body = saved.json();
    expect(body.matched).toBe(true);
    expect(body.matchedSegments).toBe(4);
    expect(body.totalSegments).toBe(4);
    expect(body.attribution).toBe('Clip E2E — Auteure E2E');
    expect(body.license).toBe('CC BY 4.0');
    expect(body.sentenceId).toBe(SENTENCE_WITH_AUDIO_ID);
    expect(typeof body.createdAt).toBe('string');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/shadowing/results',
      headers: { cookie: sessionCookie },
    });
    expect(list.json().results).toHaveLength(1);

    const otherList = await app.inject({
      method: 'GET',
      url: '/api/v1/shadowing/results',
      headers: { cookie: otherSessionCookie },
    });
    expect(otherList.json().results).toHaveLength(0);

    const otherDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/shadowing/results/${body.id}`,
      cookies: { kp_csrf: otherCsrf },
      headers: { cookie: `${otherSessionCookie}; kp_csrf=${otherCsrf}`, 'x-csrf-token': otherCsrf },
    });
    expect(otherDelete.statusCode).toBe(404);
    expect(await prisma.shadowingResult.count()).toBe(1);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/shadowing/results/${body.id}`,
      ...authHeaders(),
    });
    expect(deleted.statusCode).toBe(204);
    expect(await prisma.shadowingResult.count()).toBe(0);
  });

  it('retire tous les résultats conservés à la demande', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/results',
      ...authHeaders(),
      payload: { sentenceId: SENTENCE_TTS_ONLY_ID, source: 'tts', transcript: 'こんにちは' },
    });
    const cleared = await app.inject({
      method: 'DELETE',
      url: '/api/v1/shadowing/results',
      ...authHeaders(),
    });
    expect(cleared.statusCode).toBe(204);
    expect(await prisma.shadowingResult.count({ where: { userId } })).toBe(0);
  });

  it('signale l indisponibilité STT sans produire de résultat fictif', async () => {
    sttState.available = false;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/transcribe',
      ...authHeaders(),
      payload: {
        audioBase64: Buffer.alloc(32_000, 1).toString('base64'),
        encoding: 'pcm_s16le',
        sampleRate: 16_000,
        durationMs: 1_000,
      },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().code).toBe('STT_UNAVAILABLE');
    expect(response.json().message).toContain('indisponible');
    expect(await prisma.shadowingResult.count()).toBe(0);

    sttState.available = true;
    sttState.fail = true;
    const failing = await app.inject({
      method: 'POST',
      url: '/api/v1/shadowing/transcribe',
      ...authHeaders(),
      payload: {
        audioBase64: Buffer.alloc(32_000, 1).toString('base64'),
        encoding: 'pcm_s16le',
        sampleRate: 16_000,
        durationMs: 1_000,
      },
    });
    expect(failing.statusCode).toBe(503);
    expect(failing.json().code).toBe('STT_UNAVAILABLE');
    sttState.fail = false;
  });
});
