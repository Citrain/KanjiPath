import type { PersonalVocabularyCardKind, PersonalVocabularyOrigin, Rating } from '../enums';

export interface PersonalVocabularySourceDto {
  origin: PersonalVocabularyOrigin;
  reference: string | null;
  contentVersion: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceVersion: string | null;
  attributionText: string | null;
  license: string | null;
}

export interface PersonalVocabularyEntryDto {
  id: string;
  surface: string;
  reading: string | null;
  meaningFr: string | null;
  excerpt: string | null;
  archivedAt: string | null;
  createdAt: string;
  source: PersonalVocabularySourceDto;
  cards: Array<{ kind: PersonalVocabularyCardKind; state: string; dueAt: string }>;
}

export interface PersonalVocabularyListResponse {
  entries: PersonalVocabularyEntryDto[];
  dueCount: number;
}

export interface PersonalVocabularySessionDto {
  id: string;
  startedAt: string;
  answeredCount: number;
  correctCount: number;
  totalItems: number;
}

export interface PersonalVocabularyQueueItem {
  sessionItemId: string;
  position: number;
  kind: PersonalVocabularyCardKind;
  surface: string;
  reading: string | null;
  meaningFr: string | null;
  excerpt: string | null;
  status: 'pending' | 'answered' | 'skipped';
  wasCorrect: boolean | null;
}

export interface PersonalVocabularySessionResponse {
  session: PersonalVocabularySessionDto | null;
  items: PersonalVocabularyQueueItem[];
}

export interface PersonalVocabularyAnswerResult {
  correct: boolean;
  expectedAnswer: string | null;
  rating: Rating;
  nextDueAt: string;
}
