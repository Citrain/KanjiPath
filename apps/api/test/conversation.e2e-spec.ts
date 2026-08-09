import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { csrfCookiePlugin } from '../src/infrastructure/security/csrf-cookie.plugin';
import { ConversationLiveGateway } from '../src/modules/conversation/conversation.live-gateway';
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

describeWithDb('conversation locale (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  let csrfToken = '';
  let sessionCookie = '';
  let conversationId = '';
  let liveConversationId = '';
  const email = `conversation-${Date.now()}@example.com`;

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL_TEST;
    process.env.LOCAL_AI_ENABLED = 'false';
    const llm: LlmProvider = {
      health: async () => ({ available: true, detail: null }),
      generate: async () =>
        JSON.stringify({
          reply: { ja: 'こんにちは。元気ですか？', reading: 'Konnichiwa. Genki desu ka?' },
          correction: null,
          learning: { grammarIds: [], vocabularyIds: [], newItems: ['greeting'] },
          conversation: { shouldContinue: true, intent: 'greeting' },
        }),
    };
    const japaneseTts: JapaneseTtsProvider = {
      health: async () => ({ available: true, detail: null }),
      voices: async () => [],
      synthesize: async () => ({ mimeType: 'audio/wav', bytes: Buffer.from('RIFF') }),
    };
    const stt: SpeechToTextProvider = {
      health: async () => ({ available: true, detail: null }),
      transcribe: async () => 'こんにちは',
      startLive: async (onPartial) => ({
        write: () => onPartial('こん'),
        finish: async () => 'こんにちは',
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
    await app.register(websocket);
    app.setGlobalPrefix('api/v1');
    app.get(ConversationLiveGateway).register(app.getHttpAdapter().getInstance());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const csrf = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    csrfToken = cookieValue(csrf, 'kp_csrf');
    const registered = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password: 'mot-de-passe-e2e', displayName: 'Conversation E2E' },
    });
    sessionCookie = `kp_session=${cookieValue(registered, 'kp_session')}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('expose les diagnostics sans joindre de service tiers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/local-ai/health',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().enabled).toBe(false);
  });

  it('crée une conversation texte N5', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/conversations',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { level: 'N5', scenario: 'introduction', correctionMode: 'important' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().turns).toEqual([]);
    conversationId = response.json().id;
  });

  it('conserve le transcript final, le JSON LLM et un audio TTS non vide', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/turns`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { transcript: 'こんにちは', requestAudio: true },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().turn.transcript).toBe('こんにちは');
    expect(response.json().turn.reply.ja).toBe('こんにちは。元気ですか？');
    expect(response.json().audio.base64).toBe('UklGRg==');
    expect(response.json().usedFallback).toBe(false);
  });

  it('relaye stt.partial sans le persister, puis persiste seulement stt.final', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/conversations',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { level: 'N5', scenario: 'introduction' },
    });
    liveConversationId = created.json().id;
    const fastify = app.getHttpAdapter().getInstance();
    const socket = await fastify.injectWS(`/api/v1/conversations/${liveConversationId}/live`, {
      headers: { cookie: sessionCookie },
    });
    const events: { type: string; transcript?: string }[] = [];
    const complete = new Promise<void>((resolve, reject) => {
      socket.on('message', (raw: Buffer) => {
        const event = JSON.parse(raw.toString()) as { type: string; transcript?: string };
        events.push(event);
        if (event.type === 'turn.complete') resolve();
        if (event.type === 'error') reject(new Error(`WebSocket: ${JSON.stringify(event)}`));
      });
      socket.on('close', () => reject(new Error(`WebSocket fermé: ${JSON.stringify(events)}`)));
    });
    socket.send(JSON.stringify({ type: 'audio.chunk', encoding: 'pcm_s16le', data: 'AAE=' }));
    socket.send(JSON.stringify({ type: 'turn.complete' }));
    await complete;
    socket.close();
    expect(
      events.some((event) => event.type === 'stt.partial' && event.transcript === 'こん'),
    ).toBe(true);
    expect(
      events.some((event) => event.type === 'stt.final' && event.transcript === 'こんにちは'),
    ).toBe(true);
    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/conversations/${liveConversationId}`,
      headers: { cookie: sessionCookie },
    });
    expect(history.json().turns).toHaveLength(1);
    expect(history.json().turns[0].transcript).toBe('こんにちは');
  });

  it('retourne l’historique puis termine la conversation', async () => {
    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/conversations/${conversationId}`,
      headers: { cookie: sessionCookie },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().turns).toHaveLength(1);
    const progress = await app.inject({
      method: 'GET',
      url: '/api/v1/conversation-progress',
      headers: { cookie: sessionCookie },
    });
    expect(progress.statusCode).toBe(200);
    expect(progress.json().events.newItem).toBeGreaterThan(0);
    const end = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/end`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(end.statusCode).toBe(204);
  });

  it('reprend une conversation historique et clôture toute autre conversation active', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/reopen`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().id).toBe(conversationId);
    expect(response.json().endedAt).toBeNull();
  });
});
