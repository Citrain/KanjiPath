import { describe, expect, it } from 'vitest';
import { FsrsReviewScheduler } from './fsrs-scheduler';

const NOW = new Date('2026-08-06T10:00:00Z');

describe('FsrsReviewScheduler', () => {
  const scheduler = new FsrsReviewScheduler();

  it('creates an empty card in New state due now', () => {
    const card = scheduler.createEmptyCard(NOW);
    expect(card.state).toBe('New');
    expect(card.due.getTime()).toBe(NOW.getTime());
    expect(card.reps).toBe(0);
  });

  it('previews four rating options with increasing dues', () => {
    const card = scheduler.createEmptyCard(NOW);
    const options = scheduler.preview(card, NOW);
    expect(options.map((option) => option.rating)).toEqual(['again', 'hard', 'good', 'easy']);
    const dues = options.map((option) => option.due.getTime());
    expect(dues[0]).toBeLessThanOrEqual(dues[3] ?? 0);
  });

  it('reviewing good advances the due date and increments reps', () => {
    const card = scheduler.createEmptyCard(NOW);
    const result = scheduler.review(card, 'good', NOW);
    expect(result.card.reps).toBe(1);
    expect(result.card.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(result.log.rating).toBe('good');
    expect(result.log.stateBefore).toBe('New');
  });

  it('reviewing again keeps the card due very soon', () => {
    const card = scheduler.createEmptyCard(NOW);
    const result = scheduler.review(card, 'again', NOW);
    const oneDayLater = NOW.getTime() + 24 * 60 * 60 * 1000;
    expect(result.card.due.getTime()).toBeLessThanOrEqual(oneDayLater);
  });

  it('does not mutate the input card', () => {
    const card = scheduler.createEmptyCard(NOW);
    const repsBefore = card.reps;
    scheduler.review(card, 'good', NOW);
    expect(card.reps).toBe(repsBefore);
  });

  it('returns null retrievability for an untouched card', () => {
    const card = scheduler.createEmptyCard(NOW);
    expect(scheduler.retrievability(card, NOW)).toBeNull();
  });

  it('returns a decreasing retrievability as time passes', () => {
    const card = scheduler.review(scheduler.createEmptyCard(NOW), 'good', NOW).card;
    const soon = scheduler.retrievability(card, new Date(NOW.getTime() + 60 * 1000));
    const later = scheduler.retrievability(card, new Date(NOW.getTime() + 6 * 24 * 3600 * 1000));
    expect(soon).not.toBeNull();
    expect(later).not.toBeNull();
    expect(soon as number).toBeGreaterThan(later as number);
    expect(soon as number).toBeLessThanOrEqual(1);
    expect(later as number).toBeGreaterThanOrEqual(0);
  });
});
