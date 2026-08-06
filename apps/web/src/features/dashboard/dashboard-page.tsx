import { Badge, Button } from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../auth/api';
import { useLogout, useMe } from '../auth/use-auth';

export function DashboardPage() {
  const me = useMe();
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const logout = useLogout();

  const user = me.data?.user;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">KanjiPath</h1>
          <p className="text-sm text-zinc-500">Parcours aligné sur le JLPT</p>
        </div>
        <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Se déconnecter
        </Button>
      </header>

      <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Bonjour{user ? `, ${user.displayName}` : ''}
        </h2>
        {user ? (
          <dl className="mt-4 grid gap-2 text-sm text-zinc-600">
            <div className="flex gap-2">
              <dt className="font-medium">Email :</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Compte créé :</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">État du système</h2>
        <div className="mt-3 flex items-center gap-2">
          {health.isSuccess ? <Badge tone="success">API opérationnelle</Badge> : null}
          {health.isPending ? <Badge tone="info">Vérification…</Badge> : null}
          {health.isError ? <Badge tone="warning">API injoignable</Badge> : null}
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Les fiches kanji, révisions FSRS et exercices arrivent avec la phase 1 (MVP N5).
        </p>
      </section>
    </main>
  );
}
