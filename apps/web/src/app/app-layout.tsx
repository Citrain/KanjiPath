import { Button } from '@kanjipath/ui';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../features/auth/use-auth';
import { getStoredTheme, toggleTheme } from '../lib/theme';

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord' },
  { to: '/kanji', label: 'Kanji' },
  { to: '/etude', label: 'Étudier' },
  { to: '/sources', label: 'Sources' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getStoredTheme());

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="font-kanji gradient-accent flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-white shadow-[0_8px_24px_-8px_var(--glow)]">
              漢
            </span>
            <span className="hidden text-lg font-bold tracking-tight sm:inline">
              Kanji<span className="gradient-text">Path</span>
            </span>
          </NavLink>

          <nav
            aria-label="Navigation principale"
            className="ml-2 flex flex-1 items-center gap-1 overflow-x-auto"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_var(--accent-soft)]'
                      : 'text-muted hover:bg-card-2 hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setTheme(toggleTheme())}
            aria-label={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-lg transition-colors hover:border-line-strong hover:bg-card-2"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {me.data ? (
            <div className="flex items-center gap-2">
              <NavLink
                to="/parametres"
                aria-label="Préférences"
                className="hidden h-10 items-center gap-2 rounded-full border border-line bg-card px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:flex"
              >
                <span className="gradient-accent flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white">
                  {me.data.user.displayName.slice(0, 1).toUpperCase()}
                </span>
                {me.data.user.displayName}
              </NavLink>
              <Button
                variant="ghost"
                size="sm"
                disabled={logout.isPending}
                onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
              >
                Quitter
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">{children}</main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        KanjiPath — parcours aligné sur le JLPT (listes non officielles). Contenu sous licences
        ouvertes.
      </footer>
    </div>
  );
}
