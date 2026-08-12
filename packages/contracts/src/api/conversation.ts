import type {
  ConversationCorrectionMode,
  ConversationDifficulty,
  ConversationScenario,
  JapaneseSpeechSpeed,
  JlptLevel,
} from '../enums';

export interface ConversationTopic {
  id: ConversationScenario;
  label: string;
  description: string;
}

export interface ConversationSettings {
  enabled: boolean;
  defaultLevel: JlptLevel;
  defaultDifficulty: ConversationDifficulty;
  defaultCorrectionMode: ConversationCorrectionMode;
  maxTurnSeconds: number;
}

export interface LocalAiHealth {
  enabled: boolean;
  ollama: { available: boolean; detail: string | null };
  stt: { available: boolean; detail: string | null };
  japaneseTts: { available: boolean; detail: string | null };
}

export interface JapaneseVoice {
  id: number;
  name: string;
  styles: { id: number; name: string }[];
}

export interface ConversationCorrection {
  needed: boolean;
  severity: 'important' | 'minor';
  original: string;
  corrected: string;
  explanationFr: string;
}

export interface ConversationModelOutput {
  reply: { ja: string; reading: string };
  correction: ConversationCorrection | null;
  learning: { grammarIds: string[]; vocabularyIds: string[]; newItems: string[] };
  conversation: { shouldContinue: boolean; intent: string };
}

export interface ConversationTurnDto {
  id: string;
  position: number;
  transcript: string;
  correction: ConversationCorrection | null;
  reply: ConversationModelOutput['reply'];
  shouldContinue: boolean;
  intent: string;
  createdAt: string;
}

export interface ConversationSessionDto {
  id: string;
  level: JlptLevel;
  scenario: ConversationScenario;
  difficulty: ConversationDifficulty;
  correctionMode: ConversationCorrectionMode;
  japaneseSpeechSpeed: JapaneseSpeechSpeed;
  japaneseSpeakerId: number;
  goals: string[];
  startedAt: string;
  endedAt: string | null;
  turns: ConversationTurnDto[];
}

export interface ConversationSessionSummary {
  id: string;
  level: JlptLevel;
  scenario: ConversationScenario;
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
}

export interface ConversationProgress {
  sessions: number;
  turns: number;
  events: { grammar: number; vocabulary: number; newItem: number };
  recent: { type: 'grammar' | 'vocabulary' | 'new_item'; targetId: string; createdAt: string }[];
}

export interface CreateConversationRequest {
  level?: JlptLevel;
  scenario: ConversationScenario;
  difficulty?: ConversationDifficulty;
  correctionMode?: ConversationCorrectionMode;
  japaneseSpeechSpeed?: JapaneseSpeechSpeed;
  japaneseSpeakerId?: number;
  goals?: string[];
}

export interface ProcessConversationTurnRequest {
  transcript: string;
  requestAudio?: boolean;
}

export interface ProcessConversationTurnResponse {
  turn: ConversationTurnDto;
  audio: { mimeType: string; base64: string } | null;
}

export type ConversationLiveClientEvent =
  | { type: 'audio.chunk'; data: string; encoding: 'pcm_s16le'; final?: boolean }
  | { type: 'turn.complete' };

export type ConversationLiveServerEvent =
  | { type: 'stt.partial'; transcript: string }
  | { type: 'stt.final'; transcript: string }
  | { type: 'turn.processing' }
  | { type: 'correction.ready'; correction: ConversationCorrection | null }
  | { type: 'assistant.text'; turn: ConversationTurnDto }
  | { type: 'assistant.audio'; audio: { mimeType: string; base64: string } }
  | { type: 'turn.complete' }
  | { type: 'error'; code: string; message: string };
