import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={350} skipDelayDuration={120}>
      {children}
    </RadixTooltip.Provider>
  );
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function Tooltip({ content, children, side = 'top', align = 'center' }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={7}
          collisionPadding={8}
          className="animate-overlay-in z-50 max-w-64 rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-ink shadow-2"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
