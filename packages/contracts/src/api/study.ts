import type { ReviewCardSkill, Skill } from '../enums';

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
  mode?: 'daily' | 'weak_points' | 'free';
  level?: string;
}

export interface StudySessionDto {
  id: string;
  mode: 'daily' | 'weak_points' | 'free';
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
  rating: 'again' | 'hard' | 'good' | 'easy';
  nextDueAt: string;
}

export interface ResumeResponse {
  session: StudySessionDto | null;
  items: StudyQueueItem[];
}
