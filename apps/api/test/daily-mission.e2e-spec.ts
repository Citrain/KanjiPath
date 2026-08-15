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

describeWithDb('mission quotidienne (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sessionCookie = '';
  let csrfToken = '';
  const suffix = Date.now().toString();

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function fetchCsrf(): Promise<void> {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    csrfToken = findCookie(response, 'kp_csrf')?.value ?? '';
  }

  it('materialise une seule mission reprenable et termine ses etapes', async () => {
    await fetchCsrf();
    const registration = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        email: `mission-${suffix}@example.com`,
        password: 'mot-de-passe-e2e',
        displayName: 'Mission E2E',
      },
    });
    expect(registration.statusCode).toBe(201);
    sessionCookie = `kp_session=${findCookie(registration, 'kp_session')?.value}`;

    await prisma.vocabulary.create({
      data: {
        id: `v-mission-${suffix}`,
        writtenForm: '今日',
        reading: 'きょう',
        meaningFr: "aujourd'hui",
        estimatedLevel: 'N5',
        editorialStatus: 'published',
      },
    });
    await prisma.miniText.create({
      data: {
        id: `t-mission-${suffix}`,
        title: '今日のことば',
        body: '今日は元気です。',
        translationFr: "Aujourd'hui, je vais bien.",
        level: 'N5',
        editorialStatus: 'published',
      },
    });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/study/missions/today',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(create.statusCode).toBe(201);
    const first = create.json();
    expect(first.mission.steps.some((step: { type: string }) => step.type === 'vocabulary')).toBe(
      true,
    );
    expect(first.mission.steps.some((step: { type: string }) => step.type === 'text')).toBe(true);

    const resume = await app.inject({
      method: 'POST',
      url: '/api/v1/study/missions/today',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(resume.statusCode).toBe(201);
    expect(resume.json().mission.id).toBe(first.mission.id);

    for (const step of first.mission.steps) {
      const status = step.type === 'study' ? 'skipped' : 'completed';
      const update = await app.inject({
        method: 'POST',
        url: `/api/v1/study/missions/${first.mission.id}/steps/${step.id}`,
        cookies: { kp_csrf: csrfToken },
        headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
        payload: { status },
      });
      expect(update.statusCode).toBe(201);
    }

    const completed = await app.inject({
      method: 'GET',
      url: '/api/v1/study/missions/today',
      headers: { cookie: sessionCookie },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().mission.status).toBe('completed');
  });
});
