import type { HistoryDay } from '@kanjipath/contracts';

export interface StreakInfo {
  days: number;
  activeToday: boolean;
}

export function computeStreak(historyDays: HistoryDay[]): StreakInfo {
  const byDate = new Map<string, number>();
  for (const day of historyDays) {
    byDate.set(day.date.slice(0, 10), day.answered);
  }

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const today = new Date(cursor);

  const countFor = (date: Date): number => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    return byDate.get(key) ?? 0;
  };

  const activeToday = countFor(today) > 0;
  if (!activeToday) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (countFor(cursor) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { days: streak, activeToday };
}
