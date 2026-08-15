import { FsrsReviewScheduler } from '@kanjipath/domain';
import { describe, expect, it } from 'vitest';

describe('révision FSRS du carnet', () => {
  it('planifie une carte personnelle sans dépendre des cartes du curriculum', () => {
    const scheduler = new FsrsReviewScheduler();
    const now = new Date('2026-08-15T10:00:00.000Z');
    const personalCard = scheduler.createEmptyCard(now);
    const curriculumCard = scheduler.createEmptyCard(now);

    const result = scheduler.review(personalCard, 'good', now);

    expect(result.card.due.getTime()).toBeGreaterThan(now.getTime());
    expect(curriculumCard).toEqual(scheduler.createEmptyCard(now));
  });
});
