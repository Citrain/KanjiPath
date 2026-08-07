import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: Array<TabItem<T>>;
  ariaLabel?: string;
  className?: string;
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  ariaLabel,
  className = '',
}: TabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = items.findIndex((item) => item.value === value);
    let nextIndex = -1;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }
    const next = items[nextIndex];
    if (nextIndex < 0 || !next) {
      return;
    }
    event.preventDefault();
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex gap-1 overflow-x-auto border-b border-line ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) {
                refs.current.set(item.value, node);
              } else {
                refs.current.delete(item.value);
              }
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={`relative shrink-0 cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
              active ? 'text-ink' : 'text-muted hover:text-ink-soft'
            } inline-flex`}
          >
            {item.icon ? (
              <span aria-hidden className="[&>svg]:size-4">
                {item.icon}
              </span>
            ) : null}
            {item.label}
            <span
              aria-hidden
              className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-all duration-200 ${
                active ? 'bg-accent opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
