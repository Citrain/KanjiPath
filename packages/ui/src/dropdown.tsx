import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

export function Dropdown({ trigger, children, align = 'end', sideOffset = 8 }: DropdownProps) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          className="animate-dialog-in z-50 min-w-52 rounded-xl border border-line bg-surface-2 p-1.5 shadow-2"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface DropdownItemProps {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownItem({
  children,
  icon,
  onSelect,
  danger = false,
  disabled,
}: DropdownItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors data-[highlighted]:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-danger data-[highlighted]:bg-danger-soft'
          : 'text-ink-soft data-[highlighted]:text-ink'
      }`}
    >
      {icon ? (
        <span aria-hidden className="[&>svg]:size-4">
          {icon}
        </span>
      ) : null}
      {children}
    </DropdownMenu.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-3 pb-1.5 pt-2 text-xs font-bold uppercase tracking-wider text-muted">
      {children}
    </DropdownMenu.Label>
  );
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1.5 h-px bg-line" />;
}
