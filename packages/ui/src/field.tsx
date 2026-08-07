import { AlertCircle } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

const CONTROL_BASE =
  'w-full rounded-xl border bg-surface-2 text-[15px] text-ink placeholder:text-muted ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:outline-none focus:border-accent/70 focus:shadow-[0_0_0_3px_var(--accent-soft)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function fieldClasses(invalid?: boolean, extra = ''): string {
  return `${CONTROL_BASE} ${invalid ? 'border-danger/60' : 'border-line'} ${extra}`;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid = false, className = '', ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={fieldClasses(invalid, `h-11 px-4 ${className}`)}
      {...props}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={fieldClasses(invalid, `min-h-28 resize-y px-4 py-3 leading-relaxed ${className}`)}
      {...props}
    />
  );
}

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, children, className = '' }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
