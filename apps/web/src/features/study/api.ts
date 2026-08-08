import type {
  AnswerResult,
  CreateSessionResponse,
  ResumeResponse,
  StudySessionMode,
  StudyTarget,
} from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function createSession(
  mode: StudySessionMode = 'daily',
  target?: StudyTarget,
): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>('/study/sessions', {
    method: 'POST',
    body: JSON.stringify({ mode, target }),
  });
}

export function resumeSession(): Promise<ResumeResponse> {
  return apiFetch<ResumeResponse>('/study/resume');
}

export interface AnswerPayload {
  exerciseItemId: string;
  answer: string;
  responseTimeMs?: number;
}

export function sendAnswer(payload: AnswerPayload): Promise<AnswerResult> {
  return apiFetch<AnswerResult>('/study/answers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function finishSession(sessionId: string): Promise<void> {
  return apiFetch<void>(`/study/sessions/${sessionId}/finish`, { method: 'POST' });
}

export function abandonSession(sessionId: string): Promise<void> {
  return apiFetch<void>(`/study/sessions/${sessionId}/abandon`, { method: 'POST' });
}
