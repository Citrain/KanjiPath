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

describeWithDb('auth (integration MariaDB)', () => {
  let app: NestFastifyApplication;
  const email = `e2e-${Date.now()}@example.com`;
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function fetchCsrf(): Promise<void> {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    csrfToken = findCookie(response, 'kp_csrf')?.value ?? '';
  }

  it('GET /health répond ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  it('rejette une mutation sans jeton CSRF', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: 'E2E' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('inscrit un utilisateur et pose un cookie de session', async () => {
    await fetchCsrf();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password, displayName: 'E2E' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().user.email).toBe(email);
    const session = findCookie(response, 'kp_session');
    expect(session?.value).toBeTruthy();
    expect(session?.httpOnly).toBe(true);
    sessionCookie = `kp_session=${session?.value}`;
  });

  it('refuse une inscription dupliquée', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password, displayName: 'E2E' },
    });
    expect(response.statusCode).toBe(409);
  });

  it('rejette une inscription avec un email invalide', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email: 'pas-un-email', password, displayName: 'E2E' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('retourne le profil via GET /auth/me', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe(email);
  });

  it('supporte une rafale parallèle sur la même session (pas de 500)', async () => {
    const prisma = app.get(PrismaService);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    if (!user) {
      return;
    }
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { lastSeenAt: new Date(Date.now() - 120_000) },
    });
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/v1/auth/me',
          headers: { cookie: sessionCookie },
        }),
      ),
    );
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
    }
  });

  it('refuse /auth/me sans session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(response.statusCode).toBe(401);
  });

  it('refuse une connexion avec un mauvais mot de passe', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password: 'mauvais' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('connecte un utilisateur valide', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password },
    });
    expect(response.statusCode).toBe(201);
    expect(findCookie(response, 'kp_session')?.value).toBeTruthy();
  });

  it('déconnecte et révoque la session', async () => {
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    expect(logout.statusCode).toBe(204);
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: sessionCookie },
    });
    expect(me.statusCode).toBe(401);
  });

  it('change le mot de passe puis se reconnecte', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password },
    });
    const freshSession = `kp_session=${findCookie(login, 'kp_session')?.value}`;
    const newPassword = 'nouveau-mot-de-passe';
    const change = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      cookies: { kp_csrf: csrfToken },
      headers: { cookie: freshSession, 'x-csrf-token': csrfToken },
      payload: { currentPassword: password, newPassword },
    });
    expect(change.statusCode).toBe(204);
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      cookies: { kp_csrf: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      payload: { email, password: newPassword },
    });
    expect(relogin.statusCode).toBe(201);
  });
});
