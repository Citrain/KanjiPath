import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export const CSRF_COOKIE_NAME = 'kp_csrf';

async function register(instance: FastifyInstance): Promise<void> {
  instance.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const existing = req.cookies?.[CSRF_COOKIE_NAME];
    if (!existing) {
      const token = randomBytes(24).toString('hex');
      reply.setCookie(CSRF_COOKIE_NAME, token, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
      });
    }
  });
}

export const csrfCookiePlugin = fp(register, { name: 'kanjipath-csrf-cookie' });
