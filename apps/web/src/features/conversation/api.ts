import type {
  ConversationProgress,
  ConversationSessionDto,
  ConversationSessionSummary,
  ConversationSettings,
  ConversationTopic,
  CreateConversationRequest,
  JapaneseVoice,
  LocalAiHealth,
  ProcessConversationTurnRequest,
  ProcessConversationTurnResponse,
} from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function fetchConversationTopics(): Promise<{ topics: ConversationTopic[] }> {
  return apiFetch('/conversation-topics');
}

export function fetchConversationSettings(): Promise<ConversationSettings> {
  return apiFetch('/conversation-settings');
}

export function fetchLocalAiHealth(): Promise<LocalAiHealth> {
  return apiFetch('/local-ai/health');
}

export function fetchJapaneseVoices(): Promise<{ voices: JapaneseVoice[] }> {
  return apiFetch('/voices/ja');
}

export function fetchConversationHistory(): Promise<ConversationSessionSummary[]> {
  return apiFetch('/conversations');
}

export function fetchConversationProgress(): Promise<ConversationProgress> {
  return apiFetch('/conversation-progress');
}

export function createConversation(
  input: CreateConversationRequest,
): Promise<ConversationSessionDto> {
  return apiFetch('/conversations', { method: 'POST', body: JSON.stringify(input) });
}

export function sendConversationTurn(
  sessionId: string,
  input: ProcessConversationTurnRequest,
): Promise<ProcessConversationTurnResponse> {
  return apiFetch(`/conversations/${sessionId}/turns`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function endConversation(sessionId: string): Promise<void> {
  return apiFetch(`/conversations/${sessionId}/end`, { method: 'POST' });
}

export function reopenConversation(sessionId: string): Promise<ConversationSessionDto> {
  return apiFetch(`/conversations/${sessionId}/reopen`, { method: 'POST' });
}
