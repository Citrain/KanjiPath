import { describe, expect, it } from 'vitest';
import { computeOverallScore, DEFAULT_SKILL_WEIGHTS, isMastered } from './mastery';

const highScores = { meaning: 0.9, reading: 0.9, vocabulary: 0.9, context: 0.9, stroke: 0.9 };

describe('computeOverallScore', () => {
  it('applies default weights', () => {
    expect(computeOverallScore(highScores)).toBeCloseTo(0.9, 5);
  });

  it('normalizes custom weights', () => {
    const weights = { meaning: 1, reading: 0, vocabulary: 0, context: 0, stroke: 0 };
    const scores = { meaning: 0.5, reading: 1, vocabulary: 1, context: 1, stroke: 1 };
    expect(computeOverallScore(scores, weights)).toBeCloseTo(0.5, 5);
  });
});

describe('isMastered', () => {
  const baseInput = {
    scores: highScores,
    successfulReviews: 3,
    distinctReviewDays: 3,
    hasRecentFailure: false,
  };

  it('returns true when all conditions are met', () => {
    expect(isMastered(baseInput)).toBe(true);
  });

  it('returns false when overall score is below 85%', () => {
    expect(
      isMastered({
        ...baseInput,
        scores: { meaning: 0.7, reading: 0.7, vocabulary: 0.7, context: 0.7, stroke: 0.7 },
      }),
    ).toBe(false);
  });

  it('returns false when one skill is below 70%', () => {
    expect(
      isMastered({
        ...baseInput,
        scores: { ...highScores, reading: 0.6 },
      }),
    ).toBe(false);
  });

  it('returns false with fewer than two successful reviews', () => {
    expect(isMastered({ ...baseInput, successfulReviews: 1 })).toBe(false);
  });

  it('returns false when reviews happened on a single day', () => {
    expect(isMastered({ ...baseInput, distinctReviewDays: 1 })).toBe(false);
  });

  it('returns false after a recent failure', () => {
    expect(isMastered({ ...baseInput, hasRecentFailure: true })).toBe(false);
  });

  it('respects custom thresholds', () => {
    const thresholds = {
      minOverall: 0.5,
      minSkill: 0.5,
      minSuccessfulReviews: 1,
      minDistinctDays: 1,
    };
    expect(
      isMastered(
        {
          scores: { meaning: 0.6, reading: 0.6, vocabulary: 0.6, context: 0.6, stroke: 0.6 },
          successfulReviews: 1,
          distinctReviewDays: 1,
          hasRecentFailure: false,
        },
        thresholds,
      ),
    ).toBe(true);
  });

  it('keeps weights summing to one by default', () => {
    const total = Object.values(DEFAULT_SKILL_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});
