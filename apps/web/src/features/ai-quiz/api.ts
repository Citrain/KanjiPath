import type {
  AiQuizAnswerResult,
  AiQuizFinishResult,
  AiQuizSessionDto,
  CreateAiQuizRequest,
} from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function createAiQuiz(input: CreateAiQuizRequest): Promise<AiQuizSessionDto> {
  return apiFetch('/ai-quizzes', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchAiQuiz(id: string): Promise<AiQuizSessionDto> {
  return apiFetch(`/ai-quizzes/${id}`);
}

export function fetchAiQuizHistory(): Promise<AiQuizSessionDto[]> {
  return apiFetch('/ai-quizzes');
}

export function submitAiQuizAnswer(
  id: string,
  input: {
    questionKey: string;
    answer: {
      choiceId?: string;
      orderedTileIds?: string[];
      pairings?: { leftId: string; rightId: string }[];
    };
    responseTimeMs: number;
  },
): Promise<AiQuizAnswerResult> {
  return apiFetch(`/ai-quizzes/${id}/answers`, { method: 'POST', body: JSON.stringify(input) });
}

export function finishAiQuiz(id: string): Promise<AiQuizFinishResult> {
  return apiFetch(`/ai-quizzes/${id}/finish`, { method: 'POST' });
}

export function fetchAiQuizAudio(
  id: string,
  key: string,
): Promise<{ mimeType: string; base64: string }> {
  return apiFetch(`/ai-quizzes/${id}/questions/${key}/audio`);
}
