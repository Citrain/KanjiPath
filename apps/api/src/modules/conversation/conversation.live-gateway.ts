import type {
  ConversationLiveClientEvent,
  ConversationLiveServerEvent,
} from '@kanjipath/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SessionService } from '../auth/session.service';
import { ConversationConfig } from './conversation.config';
import { ConversationOrchestrator } from './conversation.orchestrator';
import {
  type LiveTranscription,
  type SpeechToTextProvider,
  STT_PROVIDER,
} from './conversation.providers';

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_BYTES = 64 * 1024;

interface LiveSocket {
  readyState: number;
  close(code?: number, reason?: string): void;
  send(data: string): void;
  on(event: 'message', listener: (raw: Buffer | ArrayBuffer | Buffer[]) => void): void;
}

@Injectable()
export class ConversationLiveGateway {
  private readonly logger = new Logger(ConversationLiveGateway.name);

  constructor(
    private readonly sessions: SessionService,
    private readonly orchestrator: ConversationOrchestrator,
    private readonly config: ConversationConfig,
    @Inject(STT_PROVIDER) private readonly stt: SpeechToTextProvider,
  ) {}

  register(fastify: FastifyInstance): void {
    fastify.get(
      '/api/v1/conversations/:id/live',
      { websocket: true },
      (connection: LiveSocket, request: FastifyRequest) => {
        void this.connect(connection, request);
      },
    );
  }

  private async connect(connection: LiveSocket, request: FastifyRequest): Promise<void> {
    if (!this.isTrustedOrigin(request.headers.origin)) {
      connection.close(1008, 'Origin refusée');
      return;
    }
    const pendingMessages: (Buffer | ArrayBuffer | Buffer[])[] = [];
    let receive: ((raw: Buffer | ArrayBuffer | Buffer[]) => void) | null = null;
    connection.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      if (receive) {
        receive(raw);
      } else if (pendingMessages.length < 8) {
        pendingMessages.push(raw);
      }
    });
    const token = request.cookies.kp_session;
    const resolved = token ? await this.sessions.resolve(token) : null;
    const id = (request.params as { id?: string }).id;
    if (!resolved || !id) {
      connection.close(1008, 'Authentification requise');
      return;
    }
    try {
      await this.orchestrator.getSession(resolved.userId, id);
    } catch {
      connection.close(1008, 'Conversation introuvable');
      return;
    }

    let byteCount = 0;
    let processing = false;
    let live: LiveTranscription | null = null;
    let starting: Promise<LiveTranscription> | null = null;
    let messageQueue = Promise.resolve();
    receive = (raw: Buffer | ArrayBuffer | Buffer[]) => {
      messageQueue = messageQueue
        .then(() =>
          this.handleMessage(raw, async (event) => {
            if (event.type === 'audio.chunk') {
              if (processing)
                return this.send(connection, {
                  type: 'error',
                  code: 'TURN_BUSY',
                  message: 'Tour en cours de traitement',
                });
              const chunk = decodeChunk(event.data);
              const maxAudioBytes = Math.min(
                MAX_AUDIO_BYTES,
                this.config.values.maxTurnSeconds * 16_000 * 2,
              );
              if (
                !chunk ||
                chunk.length > MAX_CHUNK_BYTES ||
                byteCount + chunk.length > maxAudioBytes
              ) {
                byteCount = 0;
                live?.close();
                live = null;
                return this.send(connection, {
                  type: 'error',
                  code: 'AUDIO_LIMIT',
                  message: 'Flux audio trop volumineux',
                });
              }
              byteCount += chunk.length;
              if (!live) {
                starting ??= this.stt.startLive((transcript) => {
                  this.send(connection, { type: 'stt.partial', transcript });
                });
                live = await starting;
                starting = null;
              }
              live.write(chunk);
              if (event.final) await finalizeAudio();
              return;
            }
            if (event.type === 'turn.complete') await finalizeAudio();
          }),
        )
        .catch((error: unknown) => {
          this.logger.warn(error instanceof Error ? error.message : 'Erreur STT live');
          this.send(connection, {
            type: 'error',
            code: 'STT_UNAVAILABLE',
            message: 'La transcription locale est indisponible. Utilisez le mode texte.',
          });
        });
    };
    for (const raw of pendingMessages) receive(raw);

    const finalizeAudio = async (): Promise<void> => {
      if (processing || byteCount === 0) return;
      processing = true;
      byteCount = 0;
      try {
        const transcript = await live?.finish();
        live = null;
        if (!transcript)
          return this.send(connection, {
            type: 'error',
            code: 'STT_EMPTY',
            message: 'Aucune parole détectée',
          });
        this.send(connection, { type: 'stt.final', transcript });
        this.send(connection, { type: 'turn.processing' });
        const result = await this.orchestrator.processTextTurn(resolved.userId, id, {
          transcript,
          requestAudio: true,
        });
        this.send(connection, { type: 'correction.ready', correction: result.turn.correction });
        this.send(connection, { type: 'assistant.text', turn: result.turn });
        if (result.audio) this.send(connection, { type: 'assistant.audio', audio: result.audio });
        this.send(connection, { type: 'turn.complete' });
      } catch (error) {
        this.logger.warn(error instanceof Error ? error.message : 'Erreur conversation live');
        this.send(connection, {
          type: 'error',
          code: 'LIVE_TURN_FAILED',
          message: 'Le tour vocal n’a pas pu être traité',
        });
      } finally {
        live?.close();
        live = null;
        processing = false;
      }
    };
  }

  private async handleMessage(
    raw: Buffer | ArrayBuffer | Buffer[],
    handler: (event: ConversationLiveClientEvent) => Promise<void>,
  ): Promise<void> {
    let value: unknown;
    try {
      const text = Buffer.isBuffer(raw)
        ? raw.toString('utf8')
        : raw instanceof ArrayBuffer
          ? Buffer.from(raw).toString('utf8')
          : Buffer.concat(raw).toString('utf8');
      value = JSON.parse(text);
    } catch {
      return;
    }
    if (!isClientEvent(value)) return;
    await handler(value);
  }

  private send(connection: LiveSocket, event: ConversationLiveServerEvent): void {
    if (connection.readyState === 1) connection.send(JSON.stringify(event));
  }

  private isTrustedOrigin(origin: string | undefined): boolean {
    if (!origin) return true;
    return (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .includes(origin);
  }
}

function decodeChunk(data: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) return null;
  return Buffer.from(data, 'base64');
}

function isClientEvent(value: unknown): value is ConversationLiveClientEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const event = value as { type?: unknown; data?: unknown; encoding?: unknown; final?: unknown };
  if (event.type === 'turn.complete') return true;
  return (
    event.type === 'audio.chunk' &&
    typeof event.data === 'string' &&
    event.encoding === 'pcm_s16le' &&
    (event.final === undefined || typeof event.final === 'boolean')
  );
}
