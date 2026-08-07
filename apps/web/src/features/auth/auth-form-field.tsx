import type { InputHTMLAttributes } from 'react';

interface AuthFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

export function AuthFormField({ label, id, ...props }: AuthFormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        className="h-12 rounded-xl border border-line bg-bg-soft px-4 text-base text-ink placeholder:text-muted focus:border-accent/60 focus:outline-2 focus:outline-accent/30"
        {...props}
      />
    </div>
  );
}
