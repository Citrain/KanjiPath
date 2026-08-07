export type ProgressTone = 'accent' | 'jade' | 'sky' | 'gold' | 'violet' | 'neutral';

const TONE_CLASSES: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  jade: 'bg-jade',
  sky: 'bg-sky',
  gold: 'bg-gold',
  violet: 'bg-violet',
  neutral: 'bg-ink-soft',
};

export interface ProgressProps {
  value: number;
  tone?: ProgressTone;
  className?: string;
  label?: string;
}

export function Progress({ value, tone = 'accent', className = '', label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-3 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${TONE_CLASSES[tone]}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
