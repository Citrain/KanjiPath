import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content
          className={`animate-dialog-in fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-6 shadow-2 focus:outline-none ${
            wide ? 'max-w-2xl' : 'max-w-lg'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer la fenêtre"
                className="-mr-1 -mt-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X aria-hidden className="size-4.5" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
