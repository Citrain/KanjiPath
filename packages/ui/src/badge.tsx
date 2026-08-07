import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'accent' | 'gold';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-card-2 text-ink-soft border border-line',
  success: 'bg-jade-soft text-jade border border-jade/25',
  warning: 'bg-accent-soft text-accent-2 border border-accent-2/25',
  info: 'bg-sky-soft text-sky border border-sky/25',
  accent: 'bg-accent-soft text-accent border border-accent/30',
  gold: 'bg-gold/15 text-gold border border-gold/30',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
