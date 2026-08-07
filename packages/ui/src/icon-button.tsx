import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary';
export type IconButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: 'bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink',
  secondary:
    'border border-line bg-surface-2 text-ink-soft hover:border-line-strong hover:text-ink',
  primary: 'bg-accent text-white shadow-glow hover:bg-accent-strong',
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'size-9 rounded-lg',
  md: 'size-10 rounded-xl',
  lg: 'size-11 rounded-xl',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  asChild?: boolean;
  children: ReactNode;
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  asChild = false,
  className = '',
  children,
  type,
  ...props
}: IconButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      type={asChild ? undefined : (type ?? 'button')}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
