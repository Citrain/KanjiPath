import type { ConversationModelOutput, JapaneseVoice } from '@kanjipath/contracts';
import { Injectable } from '@nestjs/common';
import { ConversationConfig } from './conversation.config';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
export const STT_PROVIDER = Symbol('STT_PROVIDER');
export const JAPANESE_TTS_PROVIDER = Symbol('JAPANESE_TTS_PROVIDER');
export const FRENCH_TTS_PROVIDER = Symbol('FRENCH_TTS_PROVIDER');

export interface ProviderHealth {
  available: boolean;
  detail: string | null;
}

export interface LlmConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmProvider {
  health(): Promise<ProviderHealth>;
  generate(
    systemPrompt: string,
    userMessage: string,
    history?: LlmConversationMessage[],
  ): Promise<string>;
}

export interface SpeechToTextProvider {
  health(): Promise<ProviderHealth>;
  transcribe(audio: Buffer): Promise<string>;
  startLive(onPartial: (transcript: string) => void): Promise<LiveTranscription>;
}

export interface LiveTranscription {
  write(audio: Buffer): void;
  finish(): Promise<string>;
  close(): void;
}

export interface JapaneseTtsProvider {
  health(): Promise<ProviderHealth>;
  voices(): Promise<JapaneseVoice[]>;
  synthesize(
    text: string,
    speed: number,
    speakerId: number,
  ): Promise<{ mimeType: string; bytes: Buffer }>;
}

export interface FrenchTtsProvider {
  health(): Promise<ProviderHealth>;
}

async function request(url: string, init?: RequestInit, timeoutMs = 8_000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

@Injectable()
export class OllamaProvider implements LlmProvider {
  constructor(private readonly config: ConversationConfig) {}

  async health(): Promise<ProviderHealth> {
    if (!this.config.values.enabled)
      return { available: false, detail: 'Mode IA locale désactivé' };
    try {
      const response = await request(`${this.config.values.ollamaBaseUrl}/api/tags`);
      return response.ok
        ? { available: true, detail: null }
        : { available: false, detail: `Ollama a répondu ${response.status}` };
    } catch {
      return { available: false, detail: 'Ollama est indisponible' };
    }
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    history: LlmConversationMessage[] = [],
  ): Promise<string> {
    if (!this.config.values.enabled) throw new Error('Mode IA locale désactivé');
    const response = await request(
      `${this.config.values.ollamaBaseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.config.values.ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userMessage },
          ],
          stream: false,
          format: 'json',
          think: false,
          keep_alive: '10m',
          options: { num_ctx: this.config.values.ollamaContextLength },
        }),
      },
      240_000,
    );
    if (!response.ok) throw new Error(`Ollama a répondu ${response.status}`);
    const payload: unknown = await response.json();
    if (
      !isRecord(payload) ||
      !isRecord(payload.message) ||
      typeof payload.message.content !== 'string'
    )
      throw new Error('Réponse Ollama invalide');
    return payload.message.content;
  }
}

@Injectable()
export class FasterWhisperProvider implements SpeechToTextProvider {
  constructor(private readonly config: ConversationConfig) {}

  async health(): Promise<ProviderHealth> {
    if (!this.config.values.enabled)
      return { available: false, detail: 'Mode IA locale désactivé' };
    try {
      const response = await request(`${this.config.values.sttBaseUrl}/health`);
      return response.ok
        ? { available: true, detail: null }
        : { available: false, detail: `STT a répondu ${response.status}` };
    } catch {
      return { available: false, detail: 'STT est indisponible' };
    }
  }

  async transcribe(audio: Buffer): Promise<string> {
    if (!this.config.values.enabled) throw new Error('Mode IA locale désactivé');
    const response = await request(
      `${this.config.values.sttBaseUrl}/transcribe`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          audio: audio.toString('base64'),
          encoding: 'pcm_s16le',
          sampleRate: 16_000,
          language: 'ja',
          vad: true,
        }),
      },
      60_000,
    );
    if (!response.ok) throw new Error(`STT a répondu ${response.status}`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || typeof payload.text !== 'string')
      throw new Error('Réponse STT invalide');
    return payload.text.trim();
  }

  async startLive(onPartial: (transcript: string) => void): Promise<LiveTranscription> {
    if (!this.config.values.enabled) throw new Error('Mode IA locale désactivé');
    const url = `${this.config.values.sttBaseUrl.replace('http:', 'ws:')}/ws/transcribe`;
    const socket = new WebSocket(url);
    const chunks: Buffer[] = [];
    let resolveFinal: (text: string) => void = () => undefined;
    let rejectFinal: (error: Error) => void = () => undefined;
    let finalSettled = false;
    const final = new Promise<string>((resolve, reject) => {
      resolveFinal = (text) => {
        if (finalSettled) return;
        finalSettled = true;
        resolve(text);
      };
      rejectFinal = (error) => {
        if (finalSettled) return;
        finalSettled = true;
        reject(error);
      };
    });
    // A socket can fail before finish() starts awaiting this promise.
    void final.catch(() => undefined);
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error('Connexion STT impossible')), {
        once: true,
      });
    });
    socket.addEventListener('message', (event) => {
      const payload = parseLivePayload(event.data);
      if (!payload) return;
      if (payload.type === 'stt.partial') onPartial(payload.transcript);
      if (payload.type === 'stt.final') resolveFinal(payload.transcript);
    });
    socket.addEventListener('close', () => rejectFinal(new Error('Connexion STT fermée')), {
      once: true,
    });
    socket.addEventListener('error', () => rejectFinal(new Error('Erreur STT')), { once: true });
    await opened;
    socket.send(
      JSON.stringify({
        type: 'start',
        encoding: 'pcm_s16le',
        sampleRate: 16_000,
        language: 'ja',
        vad: true,
      }),
    );
    const transcribe = this.transcribe.bind(this);
    return {
      write(audio) {
        chunks.push(audio);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'audio.chunk', data: audio.toString('base64') }));
        }
      },
      async finish() {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: 'turn.complete' }));
        try {
          return await Promise.race([
            final,
            new Promise<string>((_, reject) => {
              // large-v3-turbo on CPU needs more than 15 seconds for a completed turn.
              setTimeout(() => reject(new Error('Délai STT dépassé')), 60_000);
            }),
          ]);
        } catch {
          // Keep the audio only for this active turn when streaming is unavailable.
          return transcribe(Buffer.concat(chunks));
        }
      },
      close() {
        socket.close();
      },
    };
  }
}

@Injectable()
export class VoicevoxProvider implements JapaneseTtsProvider {
  constructor(private readonly config: ConversationConfig) {}

  async health(): Promise<ProviderHealth> {
    if (!this.config.values.enabled)
      return { available: false, detail: 'Mode IA locale désactivé' };
    try {
      const response = await request(`${this.config.values.voicevoxBaseUrl}/version`);
      return response.ok
        ? { available: true, detail: null }
        : { available: false, detail: `VOICEVOX a répondu ${response.status}` };
    } catch {
      return { available: false, detail: 'VOICEVOX est indisponible' };
    }
  }

  async voices(): Promise<JapaneseVoice[]> {
    if (!this.config.values.enabled) return [];
    const response = await request(`${this.config.values.voicevoxBaseUrl}/speakers`);
    if (!response.ok) throw new Error(`VOICEVOX a répondu ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Réponse VOICEVOX invalide');
    return payload.flatMap((speaker) => {
      if (!isRecord(speaker) || typeof speaker.name !== 'string' || !Array.isArray(speaker.styles))
        return [];
      const styles = speaker.styles.flatMap((style) =>
        isRecord(style) && typeof style.id === 'number' && typeof style.name === 'string'
          ? [{ id: style.id, name: style.name }]
          : [],
      );
      return styles.length > 0 ? [{ id: styles[0]?.id ?? 0, name: speaker.name, styles }] : [];
    });
  }

  async synthesize(
    text: string,
    speed: number,
    speakerId: number,
  ): Promise<{ mimeType: string; bytes: Buffer }> {
    if (!this.config.values.enabled) throw new Error('Mode IA locale désactivé');
    const speaker = speakerId || this.config.values.voicevoxSpeakerId;
    const queryResponse = await request(
      `${this.config.values.voicevoxBaseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
      { method: 'POST' },
      30_000,
    );
    if (!queryResponse.ok) throw new Error(`VOICEVOX a répondu ${queryResponse.status}`);
    const query: unknown = await queryResponse.json();
    if (!isRecord(query)) throw new Error('Requête VOICEVOX invalide');
    query.speedScale = speed;
    const synthesisResponse = await request(
      `${this.config.values.voicevoxBaseUrl}/synthesis?speaker=${speaker}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
      },
      30_000,
    );
    if (!synthesisResponse.ok) throw new Error(`VOICEVOX a répondu ${synthesisResponse.status}`);
    return { mimeType: 'audio/wav', bytes: Buffer.from(await synthesisResponse.arrayBuffer()) };
  }
}

@Injectable()
export class BrowserFrenchTtsProvider implements FrenchTtsProvider {
  async health(): Promise<ProviderHealth> {
    return { available: false, detail: 'La synthèse française est assurée par le navigateur' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseLivePayload(
  value: unknown,
): { type: 'stt.partial' | 'stt.final'; transcript: string } | null {
  if (typeof value !== 'string') return null;
  try {
    const payload: unknown = JSON.parse(value);
    if (
      isRecord(payload) &&
      (payload.type === 'stt.partial' || payload.type === 'stt.final') &&
      typeof payload.transcript === 'string'
    ) {
      return { type: payload.type, transcript: payload.transcript };
    }
  } catch {
    return null;
  }
  return null;
}

export function fallbackModelOutput(): ConversationModelOutput {
  return {
    reply: {
      ja: 'そうですか。もう少し詳しく教えてください。',
      reading: 'Sou desu ka. Mou sukoshi kuwashiku oshiete kudasai.',
    },
    correction: null,
    learning: { grammarIds: [], vocabularyIds: [], newItems: [] },
    conversation: { shouldContinue: true, intent: 'clarification' },
  };
}
