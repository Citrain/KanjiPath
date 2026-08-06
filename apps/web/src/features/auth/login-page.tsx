import { Button } from '@kanjipath/ui';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthFormField } from './auth-form-field';
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-zinc-900">Connexion à KanjiPath</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Parcours d'apprentissage des kanji aligné sur le JLPT.
      </p>
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
        <AuthFormField
          id="password"
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {login.isError ? (
          <p role="alert" className="text-sm text-red-600">
            Email ou mot de passe incorrect.
          </p>
        ) : null}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-zinc-600">
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-medium text-indigo-600 hover:underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}
