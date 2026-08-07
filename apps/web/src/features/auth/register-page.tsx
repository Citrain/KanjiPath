import { Button } from '@kanjipath/ui';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthFormField } from './auth-form-field';
import { AuthShell } from './auth-shell';
import { useRegister } from './use-auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    register.mutate(
      { email, password, displayName },
      {
        onSuccess: () => navigate('/'),
      },
    );
  }

  return (
    <AuthShell
      title="Commencez votre parcours"
      subtitle="Du premier trait au JLPT N1 — à votre rythme."
    >
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <AuthFormField
          id="displayName"
          label="Nom affiché"
          type="text"
          autoComplete="nickname"
          required
          minLength={1}
          maxLength={64}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <AuthFormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthFormField
          id="password"
          label="Mot de passe (8 caractères minimum)"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {register.isError ? (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            Inscription impossible. Vérifiez les informations saisies.
          </p>
        ) : null}
        <Button type="submit" size="xl" disabled={register.isPending}>
          {register.isPending ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Déjà un compte ?{' '}
        <Link to="/login" className="font-bold text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}
