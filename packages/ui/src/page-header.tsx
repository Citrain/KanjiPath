import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-5 ${className}`}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export interface SectionHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, icon, aside, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink">
        {icon ? (
          <span aria-hidden className="text-accent [&>svg]:size-4.5">
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {aside ? <div className="flex items-center gap-2">{aside}</div> : null}
    </div>
  );
}
