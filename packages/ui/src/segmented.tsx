import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
}: SegmentedProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = options.filter((option) => !option.disabled);
    const currentIndex = enabled.findIndex((option) => option.value === value);
    let nextIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % enabled.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = enabled.length - 1;
    }
    const next = enabled[nextIndex];
    if (nextIndex < 0 || !next) {
      return;
    }
    event.preventDefault();
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  }

  const optionClasses =
    size === 'sm' ? 'rounded-lg px-3 py-1.5 text-[0.8125rem]' : 'rounded-lg px-3.5 py-2 text-sm';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: bouton stylé en radio (role + aria-checked), navigation clavier gérée
          <button
            key={option.value}
            ref={(node) => {
              if (node) {
                refs.current.set(option.value, node);
              } else {
                refs.current.delete(option.value);
              }
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`${optionClasses} cursor-pointer whitespace-nowrap font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
              active
                ? 'bg-accent text-white shadow-1'
                : 'text-muted hover:bg-surface-3 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
