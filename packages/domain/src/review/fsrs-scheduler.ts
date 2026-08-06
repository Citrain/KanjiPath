import type { Rating } from '@kanjipath/contracts';
import {
  type Card,
  createEmptyCard,
  Rating as FsrsRating,
  State as FsrsState,
  fsrs,
  type Grade,
} from 'ts-fsrs';
import type {
  ReviewCard,
  ReviewCardState,
  ReviewOption,
  ReviewResult,
  ReviewScheduler,
} from './types';

const RATING_TO_FSRS: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

const STATE_TO_FSRS: Record<ReviewCardState, FsrsState> = {
  New: FsrsState.New,
  Learning: FsrsState.Learning,
  Review: FsrsState.Review,
  Relearning: FsrsState.Relearning,
};

const FSRS_STATE_TO_STATE: Record<number, ReviewCardState> = {
  [FsrsState.New]: 'New',
  [FsrsState.Learning]: 'Learning',
  [FsrsState.Review]: 'Review',
  [FsrsState.Relearning]: 'Relearning',
};

export class FsrsReviewScheduler implements ReviewScheduler {
  private readonly scheduler = fsrs();

  createEmptyCard(now: Date): ReviewCard {
    return fromFsrsCard(createEmptyCard(now));
  }

  preview(card: ReviewCard, now: Date): ReviewOption[] {
    const results = this.scheduler.repeat(toFsrsCard(card), now);
    return (Object.keys(RATING_TO_FSRS) as Rating[]).map((rating) => {
      const item = results[RATING_TO_FSRS[rating]];
      return {
        rating,
        due: item.card.due,
        state: FSRS_STATE_TO_STATE[item.card.state] ?? 'New',
      };
    });
  }

  review(card: ReviewCard, rating: Rating, now: Date): ReviewResult {
    const results = this.scheduler.repeat(toFsrsCard(card), now);
    const item = results[RATING_TO_FSRS[rating]];
    return {
      card: fromFsrsCard(item.card),
      log: {
        rating,
        stateBefore: card.state,
        stateAfter: FSRS_STATE_TO_STATE[item.log.state] ?? card.state,
        due: item.card.due,
        elapsedDays: item.log.elapsed_days,
        scheduledDays: item.log.scheduled_days,
        reviewAt: item.log.review,
      },
    };
  }
}

function toFsrsCard(card: ReviewCard): Card {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_FSRS[card.state],
    last_review: card.lastReview ?? undefined,
  };
}

function fromFsrsCard(card: Card): ReviewCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: FSRS_STATE_TO_STATE[card.state] ?? 'New',
    lastReview: card.last_review ?? null,
  };
}
