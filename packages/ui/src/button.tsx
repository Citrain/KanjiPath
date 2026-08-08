import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-to-r from-accent to-accent-2 text-white shadow-glow ' +
    'hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:brightness-95',
  secondary:
    'border border-line-strong bg-surface-2 text-ink ' +
    'hover:border-accent/40 hover:bg-surface-3 active:bg-surface-2',
  ghost: 'bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3.5 text-sm',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
  xl: 'h-13 gap-2.5 rounded-full px-8 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  asChild = false,
  className = '',
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  const base =
    'inline-flex items-center justify-center whitespace-nowrap font-semibold tracking-wide ' +
    'transition-all duration-200 cursor-pointer select-none ' +
    'disabled:pointer-events-none disabled:opacity-45';
  const content =
    loading && !asChild ? (
      <>
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
        {children}
      </>
    ) : (
      children
    );
  return (
    <Component
      type={asChild ? undefined : (type ?? 'button')}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={asChild ? undefined : loading || undefined}
      className={`${base} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {content}
    </Component>
  );
}
