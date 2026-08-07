import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé sous <ToastProvider>');
  }
  return context;
}

const KIND_META: Record<ToastKind, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-jade' },
  error: { icon: AlertCircle, className: 'text-danger' },
  info: { icon: Info, className: 'text-sky' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:items-end"
      >
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              role="status"
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-ink shadow-2"
            >
              <Icon aria-hidden className={`size-4.5 shrink-0 ${meta.className}`} />
              <span className="flex-1">{item.message}</span>
              <button
                type="button"
                aria-label="Fermer la notification"
                onClick={() => dismiss(item.id)}
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
