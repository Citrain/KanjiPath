import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'accent' | 'danger' | 'violet';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-soft border-line',
  success: 'bg-jade-soft text-jade border-jade/25',
  warning: 'bg-gold-soft text-gold border-gold/30',
  info: 'bg-sky-soft text-sky border-sky/25',
  accent: 'bg-accent-soft text-accent border-accent/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  violet: 'bg-violet-soft text-violet border-violet/30',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}

export function BadgeDot({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-block size-1.5 rounded-full bg-current ${className}`} />
  );
}
