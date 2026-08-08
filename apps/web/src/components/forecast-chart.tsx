import type { DueForecastDay } from '@kanjipath/contracts';
import { formatDateShort } from '../lib/format';

export function ForecastChart({ days }: { days: DueForecastDay[] }) {
  const maxCount = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <div>
      <div
        className="flex h-32 items-end gap-2"
        role="img"
        aria-label={`Charge de révision prévue : ${total} carte${total > 1 ? 's' : ''} sur les 7 prochains jours`}
      >
        {days.map((day, index) => {
          const ratio = day.count > 0 ? Math.max(0.08, day.count / maxCount) : 0;
          return (
            <div key={day.date} className="group relative flex h-full flex-1 flex-col justify-end">
              {day.count > 0 ? (
                <div
                  className={`w-full rounded-md transition-all duration-200 group-hover:brightness-110 ${
                    index === 0 ? 'bg-gold' : 'bg-gold/60'
                  }`}
                  style={{ height: `${ratio * 100}%` }}
                />
              ) : (
                <div className="h-1 w-full rounded-full bg-surface-3" />
              )}
              <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-2 transition-opacity duration-150 group-hover:opacity-100">
                {index === 0 ? 'Aujourd’hui' : formatDateShort(day.date)} · {day.count} carte
                {day.count > 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[0.6875rem] font-semibold text-muted">
        <span>Aujourd’hui</span>
        <span>+7 jours</span>
      </div>
    </div>
  );
}
