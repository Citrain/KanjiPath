import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { csrfCookiePlugin } from './infrastructure/security/csrf-cookie.plugin';
import { ConversationLiveGateway } from './modules/conversation/conversation.live-gateway';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  await app.register(cookie);
  await app.register(csrfCookiePlugin);
  await app.register(websocket);

  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  await app.register(cors, { origin: origins, credentials: true });

  app.setGlobalPrefix('api/v1');
  app.get(ConversationLiveGateway).register(app.getHttpAdapter().getInstance());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
