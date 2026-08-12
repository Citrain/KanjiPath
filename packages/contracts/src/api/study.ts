import type { JlptLevel, ReviewCardSkill, Skill, StudySessionMode } from '../enums';

export interface StudyTarget {
  level?: JlptLevel;
  skill?: Skill;
  kanjiIds?: string[];
}

export interface StudyExercisePrompt {
  [key: string]: unknown;
}

export interface StudyQueueItem {
  sessionItemId: string;
  position: number;
  exerciseItemId: string;
  template: string;
  skill: Skill;
  cardSkill: ReviewCardSkill;
  kanjiLiteral: string;
  prompt: StudyExercisePrompt;
  options: string[];
  status: 'pending' | 'answered' | 'skipped';
  wasCorrect: boolean | null;
}

export interface CreateSessionRequest {
  mode?: StudySessionMode;
  target?: StudyTarget;
}

export interface StudySessionDto {
  id: string;
  mode: StudySessionMode;
  target: StudyTarget | null;
  startedAt: string;
  answeredCount: number;
  correctCount: number;
  totalItems: number;
}

export interface CreateSessionResponse {
  session: StudySessionDto;
  items: StudyQueueItem[];
}

export interface AnswerRequest {
  exerciseItemId: string;
  answer: string;
  responseTimeMs?: number;
  rating?: 'again' | 'hard' | 'good' | 'easy';
}

export interface AnswerResult {
  correct: boolean;
  acceptedAnswers: string[];
  explanation: string | null;
  readings: Array<{
    reading: string;
    romaji: string | null;
  }>;
  rating: 'again' | 'hard' | 'good' | 'easy';
  nextDueAt: string;
}

export interface ResumeResponse {
  session: StudySessionDto | null;
  items: StudyQueueItem[];
}
