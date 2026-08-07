import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padded?: boolean;
}

export function Card({ hover = false, padded = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-line bg-card ${padded ? 'p-6' : ''} ${hover ? 'card-hover' : ''} ${className}`}
      {...props}
    />
  );
}
