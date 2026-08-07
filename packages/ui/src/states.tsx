import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';

export interface EmptyStateProps {
  glyph?: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  glyph,
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-14 text-center ${className}`}>
      {glyph ? (
        <span
          aria-hidden
          className="font-jp flex size-16 items-center justify-center rounded-2xl border border-line bg-surface-2 text-3xl text-muted"
        >
          {glyph}
        </span>
      ) : icon ? (
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface-2 text-muted [&>svg]:size-7"
        >
          {icon}
        </span>
      ) : null}
      <p className="text-base font-bold text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  description,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-3 rounded-2xl border border-danger/25 bg-danger-soft px-6 py-12 text-center ${className}`}
    >
      <TriangleAlert aria-hidden className="size-8 text-danger" />
      <p className="text-base font-bold text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}
