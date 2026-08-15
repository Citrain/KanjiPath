import type {
  AnswerPersonalVocabularyInput,
  CreatePersonalVocabularyEntryInput,
  PersonalVocabularyAnswerResult,
  PersonalVocabularyEntryDto,
  PersonalVocabularyListResponse,
  PersonalVocabularySessionResponse,
} from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function fetchPersonalVocabulary(archived = false): Promise<PersonalVocabularyListResponse> {
  return apiFetch<PersonalVocabularyListResponse>(`/personal-vocabulary?archived=${archived}`);
}

export function savePersonalVocabulary(
  input: CreatePersonalVocabularyEntryInput,
): Promise<PersonalVocabularyEntryDto> {
  return apiFetch<PersonalVocabularyEntryDto>('/personal-vocabulary', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function archivePersonalVocabulary(id: string): Promise<PersonalVocabularyEntryDto> {
  return apiFetch<PersonalVocabularyEntryDto>(`/personal-vocabulary/${id}/archive`, {
    method: 'POST',
  });
}

export function restorePersonalVocabulary(id: string): Promise<PersonalVocabularyEntryDto> {
  return apiFetch<PersonalVocabularyEntryDto>(`/personal-vocabulary/${id}/restore`, {
    method: 'POST',
  });
}

export function deletePersonalVocabulary(id: string): Promise<void> {
  return apiFetch<void>(`/personal-vocabulary/${id}`, { method: 'DELETE' });
}

export function createPersonalVocabularySession(): Promise<PersonalVocabularySessionResponse> {
  return apiFetch<PersonalVocabularySessionResponse>('/personal-vocabulary/sessions', {
    method: 'POST',
  });
}

export function resumePersonalVocabularySession(): Promise<PersonalVocabularySessionResponse> {
  return apiFetch<PersonalVocabularySessionResponse>('/personal-vocabulary/resume');
}

export function answerPersonalVocabulary(
  input: AnswerPersonalVocabularyInput,
): Promise<PersonalVocabularyAnswerResult> {
  return apiFetch<PersonalVocabularyAnswerResult>('/personal-vocabulary/answers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function finishPersonalVocabularySession(id: string): Promise<void> {
  return apiFetch<void>(`/personal-vocabulary/sessions/${id}/finish`, { method: 'POST' });
}
