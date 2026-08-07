import type { ReactNode } from 'react';

export type RingTone = 'accent' | 'jade' | 'sky' | 'gold' | 'violet' | 'danger';

const TONE_CLASSES: Record<RingTone, string> = {
  accent: 'stroke-accent',
  jade: 'stroke-jade',
  sky: 'stroke-sky',
  gold: 'stroke-gold',
  violet: 'stroke-violet',
  danger: 'stroke-danger',
};

export interface RingProps {
  value: number;
  size?: number;
  stroke?: number;
  tone?: RingTone;
  label?: string;
  className?: string;
  barClassName?: string;
  children?: ReactNode;
}

export function Ring({
  value,
  size = 140,
  stroke = 10,
  tone = 'accent',
  label,
  className = '',
  barClassName,
  children,
}: RingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${barClassName ?? TONE_CLASSES[tone]} transition-[stroke-dashoffset] duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
