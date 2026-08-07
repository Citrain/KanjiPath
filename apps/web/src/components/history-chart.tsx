import type { HistoryDay } from '@kanjipath/contracts';
import { formatDateShort } from '../lib/format';

const WINDOW_DAYS = 30;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function HistoryChart({ days }: { days: HistoryDay[] }) {
  const byKey = new Map<string, HistoryDay>();
  for (const day of days) {
    byKey.set(day.date.slice(0, 10), day);
  }

  const daysWindow: HistoryDay[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (WINDOW_DAYS - 1));
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const key = dayKey(cursor);
    const existing = byKey.get(key);
    daysWindow.push(
      existing ?? {
        date: `${key}T00:00:00.000Z`,
        answered: 0,
        correct: 0,
      },
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  const maxAnswered = Math.max(1, ...daysWindow.map((day) => day.answered));
  const totalAnswered = daysWindow.reduce((sum, day) => sum + day.answered, 0);
  const totalCorrect = daysWindow.reduce((sum, day) => sum + day.correct, 0);
  const first = daysWindow[0];
  const last = daysWindow[daysWindow.length - 1];

  return (
    <div>
      <div
        className="flex h-40 items-end gap-[3px]"
        role="img"
        aria-label={`Activité : ${totalAnswered} réponses dont ${totalCorrect} correctes sur les 30 derniers jours`}
      >
        {daysWindow.map((day, index) => {
          const isToday = index === daysWindow.length - 1;
          const ratio = day.answered > 0 ? Math.max(0.08, day.answered / maxAnswered) : 0;
          return (
            <div key={day.date} className="group relative flex h-full flex-1 flex-col justify-end">
              {day.answered > 0 ? (
                <div
                  className={`w-full rounded-[4px] transition-all duration-200 group-hover:brightness-110 ${
                    isToday ? 'bg-accent' : 'bg-accent/70'
                  }`}
                  style={{ height: `${ratio * 100}%` }}
                />
              ) : (
                <div className="h-1 w-full rounded-full bg-surface-3" />
              )}
              <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-2 transition-opacity duration-150 group-hover:opacity-100">
                {formatDateShort(day.date)}
                {day.answered > 0
                  ? ` · ${day.correct}/${day.answered} correctes`
                  : ' · aucune activité'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted">
        <span>{first ? formatDateShort(first.date) : ''}</span>
        <span>{last ? formatDateShort(last.date) : ''}</span>
      </div>
    </div>
  );
}
