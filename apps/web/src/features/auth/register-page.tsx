import { Button } from '@kanjipath/ui';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthFormField } from './auth-form-field';
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-zinc-900">Créer un compte KanjiPath</h1>
      <p className="mt-1 text-sm text-zinc-500">Commencez votre parcours kanji, du N5 au N1.</p>
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
          <p role="alert" className="text-sm text-red-600">
            Inscription impossible. Vérifiez les informations saisies.
          </p>
        ) : null}
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-zinc-600">
        Déjà un compte ?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
