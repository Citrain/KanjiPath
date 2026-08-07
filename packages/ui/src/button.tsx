import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'gradient-accent text-white shadow-[0_10px_30px_-12px_var(--glow)] hover:brightness-110 active:brightness-95',
  secondary: 'border border-line-strong bg-card-2 text-ink hover:bg-panel hover:border-line-strong',
  ghost: 'bg-transparent text-ink-soft hover:bg-card-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
  gold: 'bg-gold text-[#241a05] hover:brightness-105',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-8 text-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  asChild = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-wide ' +
    'transition-all duration-200 cursor-pointer select-none ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    'disabled:pointer-events-none disabled:opacity-45 min-h-11';
  return (
    <Component
      className={`${base} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
