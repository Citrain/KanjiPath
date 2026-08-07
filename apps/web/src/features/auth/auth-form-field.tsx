import { Field, Input } from '@kanjipath/ui';
import { Eye, EyeClosed } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { useState } from 'react';

interface AuthFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  hint?: string;
}

export function AuthFormField({ label, id, hint, ...props }: AuthFormFieldProps) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} {...props} />
    </Field>
  );
}

export function AuthPasswordField({ label, id, ...props }: AuthFormFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <Input id={id} type={visible ? 'text' : 'password'} className="pr-12" {...props} />
        <button
          type="button"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-xl text-muted transition-colors hover:text-ink"
        >
          {visible ? (
            <EyeClosed aria-hidden className="size-4.5" />
          ) : (
            <Eye aria-hidden className="size-4.5" />
          )}
        </button>
      </div>
    </Field>
  );
}
