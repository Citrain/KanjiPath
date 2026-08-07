import type { ReactNode } from 'react';

export type StatTone = 'default' | 'accent' | 'jade' | 'sky' | 'gold' | 'violet';

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'bg-surface-2 text-ink-soft',
  accent: 'bg-accent-soft text-accent',
  jade: 'bg-jade-soft text-jade',
  sky: 'bg-sky-soft text-sky',
  gold: 'bg-gold-soft text-gold',
  violet: 'bg-violet-soft text-violet',
};

export interface StatProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, icon, tone = 'default', hint, className = '' }: StatProps) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <div className="flex items-center gap-3">
        {icon ? (
          <span
            aria-hidden
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5 ${TONE_CLASSES[tone]}`}
          >
            {icon}
          </span>
        ) : null}
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{value}</div>
      {hint ? <p className="mt-1 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}
