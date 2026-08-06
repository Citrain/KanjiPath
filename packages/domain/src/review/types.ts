import type { Rating } from '@kanjipath/contracts';

export type ReviewCardState = 'New' | 'Learning' | 'Review' | 'Relearning';

export interface ReviewCard {
  state: ReviewCardState;
  due: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  lastReview: Date | null;
}

export interface ReviewOption {
  rating: Rating;
  due: Date;
  state: ReviewCardState;
}

export interface ReviewLog {
  rating: Rating;
  stateBefore: ReviewCardState;
  stateAfter: ReviewCardState;
  due: Date;
  elapsedDays: number;
  scheduledDays: number;
  reviewAt: Date;
}

export interface ReviewResult {
  card: ReviewCard;
  log: ReviewLog;
}

export interface ReviewScheduler {
  preview(card: ReviewCard, now: Date): ReviewOption[];
  review(card: ReviewCard, rating: Rating, now: Date): ReviewResult;
}
