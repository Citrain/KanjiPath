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

function cookieValue(
  response: { cookies: { name: string; value: string }[] },
  name: string,
): string {
  return response.cookies.find((entry) => entry.name === name)?.value ?? '';
}

const quiz = {
  questions: [
    {
      type: 'conjugation_qcm',
      japanese: 'たべます → ＿＿＿',
      kana: 'たべます → ＿＿＿',
      options: ['たべました', 'たべます', 'たべません', 'たべましょう'],
      answerIndex: 0,
      explanationFr: 'たべます devient たべました.',
    },
    {
      type: 'listening_qcm',
      japanese: 'みずをください。',
      kana: 'みずをください。',
      options: [
        'De l’eau, s’il vous plaît.',
        'L’addition, s’il vous plaît.',
        'Le menu, s’il vous plaît.',
        'Du thé, s’il vous plaît.',
      ],
      answerIndex: 0,
      explanationFr: 'みず signifie eau.',
    },
    {
      type: 'meaning_qcm',
      japanese: 'みせ',
      kana: 'みせ',
      options: ['magasin', 'gare', 'école', 'hôpital'],
      answerIndex: 0,
      explanationFr: 'みせ signifie magasin.',
    },
    {
      type: 'conjugation_qcm',
      japanese: 'のみます → ＿＿＿',
      kana: 'のみます → ＿＿＿',
      options: ['のみました', 'のみます', 'のみません', 'のみましょう'],
      answerIndex: 0,
      explanationFr: 'のみます devient のみました.',
    },
    {
      type: 'listening_qcm',
      japanese: 'おちゃをください。',
      kana: 'おちゃをください。',
      options: [
        'Du thé, s’il vous plaît.',
        'De l’eau, s’il vous plaît.',
        'Le menu, s’il vous plaît.',
        'L’addition, s’il vous plaît.',
      ],
      answerIndex: 0,
      explanationFr: 'おちゃ signifie thé.',
    },
  ],
};

const alternateQuiz = {
  questions: [
    {
      ...quiz.questions[0]!,
      japanese: 'たのみます → ＿＿＿',
      kana: 'たのみます → ＿＿＿',
      options: ['たのみました', 'たのみます', 'たのみません', 'たのみましょう'],
      explanationFr: 'たのみます devient たのみました.',
    },
    {
      ...quiz.questions[1]!,
      japanese: 'ごはんをください。',
      kana: 'ごはんをください。',
      explanationFr: 'ごはん signifie repas ou riz.',
    },
    {
      ...quiz.questions[2]!,
      japanese: 'レストラン',
      kana: 'れすとらん',
      options: ['restaurant', 'gare', 'école', 'hôpital'],
      explanationFr: 'レストラン signifie restaurant.',
    },
    {
      ...quiz.questions[3]!,
      japanese: 'かいます → ＿＿＿',
      kana: 'かいます → ＿＿＿',
      options: ['かいました', 'かいます', 'かいません', 'かいましょう'],
      explanationFr: 'かいます devient かいました.',
    },
    {
      ...quiz.questions[4]!,
      japanese: 'メニューをください。',
      kana: 'めにゅーをください。',
      explanationFr: 'メニュー signifie menu.',
    },
  ],
};

describeWithDb('quiz IA local (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  let csrfToken = '';
  let sessionCookie = '';
  let quizId = '';
  const generatedPrompts: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL_TEST;
    let questionIndex = 0;
    const llm: LlmProvider = {
      health: async () => ({ available: true, detail: null }),
      generate: async (systemPrompt) => {
        generatedPrompts.push(systemPrompt);
        const source = questionIndex < quiz.questions.length ? quiz : alternateQuiz;
        const { type: _type, ...question } = source.questions[questionIndex % 5]!;
        questionIndex += 1;
        return JSON.stringify(question);
      },
    };
    const japaneseTts: JapaneseTtsProvider = {
      health: async () => ({ available: true, detail: null }),
      voices: async () => [],
      synthesize: async () => ({ mimeType: 'audio/wav', bytes: Buffer.from('RIFF') }),
    };
    const stt: SpeechToTextProvider = {
      health: async () => ({ available: true, detail: null }),
      transcribe: async () => '',
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
      payload: {
        email: `quiz-${Date.now()}@example.com`,
        password: 'mot-de-passe-e2e',
        displayName: 'Quiz E2E',
      },
    });
    sessionCookie = `kp_session=${cookieValue(registered, 'kp_session')}`;
  });

  afterAll(async () => app.close());

  it('génère un snapshot public sans correction ni transcript audio', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai-quizzes',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: {
        prompt: 'Réviser le restaurant',
        level: 'N5',
        questionCount: 5,
        types: ['conjugation_qcm', 'listening_qcm', 'meaning_qcm'],
        skills: ['grammar', 'listening', 'vocabulary'],
      },
    });
    expect(response.statusCode).toBe(201);
    const payload = response.json();
    quizId = payload.id;
    expect(payload.quiz.questions[0]).not.toHaveProperty('correct');
    expect(payload.quiz.questions[1].prompt).not.toHaveProperty('audioText');
  });

  it('exclut les questions persistées quand la même mission est redemandée', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai-quizzes',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: {
        prompt: 'Réviser le restaurant',
        level: 'N5',
        questionCount: 5,
        types: ['conjugation_qcm', 'listening_qcm', 'meaning_qcm'],
        skills: ['grammar', 'listening', 'vocabulary'],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(generatedPrompts[5]).toContain('たべます → ＿＿＿');
    const first = new Set(quiz.questions.map((question) => question.japanese));
    expect(
      response
        .json()
        .quiz.questions.every(
          (question: { prompt: { japanese?: string } }) =>
            !question.prompt.japanese || !first.has(question.prompt.japanese),
        ),
    ).toBe(true);
  });

  it('corrige une seule fois, synthétise l’écoute et clôture le quiz', async () => {
    const answer = await app.inject({
      method: 'POST',
      url: `/api/v1/ai-quizzes/${quizId}/answers`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { questionKey: 'q1', answer: { choiceId: 'a' }, responseTimeMs: 900 },
    });
    expect(answer.statusCode).toBe(201);
    expect(answer.json().correct).toBe(true);
    expect(answer.json().correctAnswer).toEqual({ choiceId: 'a' });
    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/ai-quizzes/${quizId}/answers`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
      payload: { questionKey: 'q1', answer: { choiceId: 'a' } },
    });
    expect(duplicate.statusCode).toBe(400);
    const audio = await app.inject({
      method: 'GET',
      url: `/api/v1/ai-quizzes/${quizId}/questions/q2/audio`,
      headers: { cookie: sessionCookie },
    });
    expect(audio.statusCode).toBe(200);
    expect(audio.json().base64).toBe('UklGRg==');
    const finish = await app.inject({
      method: 'POST',
      url: `/api/v1/ai-quizzes/${quizId}/finish`,
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(finish.statusCode).toBe(201);
    expect(finish.json().correctCount).toBe(1);
  });
});
