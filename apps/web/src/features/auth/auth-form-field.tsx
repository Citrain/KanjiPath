import type { InputHTMLAttributes } from 'react';

interface AuthFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

export function AuthFormField({ label, id, ...props }: AuthFormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={id}
        className="h-11 rounded-md border border-zinc-300 px-3 text-base focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500/40"
        {...props}
      />
    </div>
  );
}
