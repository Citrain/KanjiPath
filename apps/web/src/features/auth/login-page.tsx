import { Button } from '@kanjipath/ui';
import { TriangleAlert } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthFormField, AuthPasswordField } from './auth-form-field';
import { AuthShell } from './auth-shell';
import { useLogin } from './use-auth';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate('/'),
      },
    );
  }

  return (
    <AuthShell
      title="Bon retour parmi nous"
      subtitle="Reprenez votre parcours là où vous l'aviez laissé."
    >
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <AuthFormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthPasswordField
          id="password"
          label="Mot de passe"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {login.isError ? (
          <p
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          >
            <TriangleAlert aria-hidden className="size-4.5 shrink-0" />
            Email ou mot de passe incorrect.
          </p>
        ) : null}
        <Button type="submit" size="xl" loading={login.isPending} className="mt-2">
          {login.isPending ? 'Connexion…' : 'Continuer ma progression'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-bold text-accent hover:underline">
          Commencer gratuitement
        </Link>
      </p>
    </AuthShell>
  );
}
