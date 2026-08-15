import { describe, expect, it, vi } from 'vitest';
import { localDateKey, StudyService } from './study.service';

describe('localDateKey', () => {
  it('uses the user timezone instead of the server date', () => {
    const instant = new Date('2026-08-15T22:30:00.000Z');

    expect(localDateKey(instant, 'Europe/Paris')).toBe('2026-08-16');
    expect(localDateKey(instant, 'America/Los_Angeles')).toBe('2026-08-15');
  });

  it('falls back to UTC for an invalid timezone', () => {
    expect(localDateKey(new Date('2026-08-15T22:30:00.000Z'), 'invalid/timezone')).toBe(
      '2026-08-15',
    );
  });
});

describe('StudyService daily mission', () => {
  it('returns the persisted mission for the same local day without rebuilding it', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: 'mission-1' })
      .mockResolvedValueOnce({
        id: 'mission-1',
        localDate: '2026-08-15',
        status: 'active',
        startedAt: new Date('2026-08-15T10:00:00.000Z'),
        completedAt: null,
        steps: [],
        studySession: null,
      });
    const transaction = vi.fn();
    const service = new StudyService({
      userSettings: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Europe/Paris' }) },
      dailyMission: { findUnique },
      vocabulary: { findMany: vi.fn().mockResolvedValue([]) },
      miniText: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: transaction,
    } as never);

    const response = await service.createDailyMission('user-1');

    expect(response.mission?.id).toBe('mission-1');
    expect(transaction).not.toHaveBeenCalled();
  });
});
