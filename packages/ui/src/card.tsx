import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padded?: boolean;
}

export function Card({ hover = false, padded = true, className = '', ...props }: CardProps) {
  const interactive = hover
    ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2 '
    : '';
  return (
    <div
      className={`rounded-2xl border border-line bg-surface ${padded ? 'p-5 sm:p-6' : ''} ${interactive}${className}`}
      {...props}
    />
  );
}

export function CardTitle({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <h2 id={id} className={`text-base font-bold tracking-tight text-ink ${className}`}>
      {children}
    </h2>
  );
}
