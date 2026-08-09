import { Injectable } from '@nestjs/common';

export interface ConversationConfigValues {
  enabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaContextLength: number;
  sttBaseUrl: string;
  voicevoxBaseUrl: string;
  voicevoxSpeakerId: number;
  voicevoxSpeed: number;
  defaultLevel: 'N5' | 'N4';
  defaultDifficulty: 'easy' | 'normal' | 'hard';
  defaultCorrectionMode: 'none' | 'important' | 'all' | 'end_of_turn' | 'end_of_session';
  maxTurnSeconds: number;
}

function loopbackUrl(value: string, name: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') {
    throw new Error(`${name} doit utiliser une URL HTTP loopback`);
  }
  return url.toString().replace(/\/$/, '');
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} doit être un entier positif`);
  }
  return parsed;
}

@Injectable()
export class ConversationConfig {
  readonly values: ConversationConfigValues;

  constructor() {
    const defaultLevel = process.env.CONVERSATION_DEFAULT_LEVEL ?? 'N5';
    const defaultDifficulty = process.env.CONVERSATION_DEFAULT_DIFFICULTY ?? 'easy';
    const defaultCorrectionMode = process.env.CONVERSATION_DEFAULT_CORRECTION_MODE ?? 'important';
    if (defaultLevel !== 'N5' && defaultLevel !== 'N4') {
      throw new Error('CONVERSATION_DEFAULT_LEVEL doit être N5 ou N4');
    }
    if (!['easy', 'normal', 'hard'].includes(defaultDifficulty)) {
      throw new Error('CONVERSATION_DEFAULT_DIFFICULTY invalide');
    }
    if (
      !['none', 'important', 'all', 'end_of_turn', 'end_of_session'].includes(defaultCorrectionMode)
    ) {
      throw new Error('CONVERSATION_DEFAULT_CORRECTION_MODE invalide');
    }
    const speed = Number(process.env.VOICEVOX_DEFAULT_SPEED ?? '1');
    if (!Number.isFinite(speed) || speed <= 0 || speed > 2) {
      throw new Error('VOICEVOX_DEFAULT_SPEED doit être entre 0 et 2');
    }
    this.values = {
      enabled: process.env.LOCAL_AI_ENABLED === 'true',
      ollamaBaseUrl: loopbackUrl(
        process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
        'OLLAMA_BASE_URL',
      ),
      ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen3.5:9b-q8_0',
      ollamaContextLength: positiveInteger(
        process.env.OLLAMA_CONTEXT_LENGTH,
        16_384,
        'OLLAMA_CONTEXT_LENGTH',
      ),
      sttBaseUrl: loopbackUrl(process.env.STT_BASE_URL ?? 'http://127.0.0.1:8765', 'STT_BASE_URL'),
      voicevoxBaseUrl: loopbackUrl(
        process.env.VOICEVOX_BASE_URL ?? 'http://127.0.0.1:50021',
        'VOICEVOX_BASE_URL',
      ),
      voicevoxSpeakerId: positiveInteger(process.env.VOICEVOX_SPEAKER_ID, 1, 'VOICEVOX_SPEAKER_ID'),
      voicevoxSpeed: speed,
      defaultLevel,
      defaultDifficulty: defaultDifficulty as ConversationConfigValues['defaultDifficulty'],
      defaultCorrectionMode:
        defaultCorrectionMode as ConversationConfigValues['defaultCorrectionMode'],
      maxTurnSeconds: positiveInteger(
        process.env.CONVERSATION_MAX_TURN_SECONDS,
        60,
        'CONVERSATION_MAX_TURN_SECONDS',
      ),
    };
  }
}
