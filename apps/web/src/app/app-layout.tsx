import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  IconButton,
  ToastProvider,
  TooltipProvider,
} from '@kanjipath/ui';
import { useQuery } from '@tanstack/react-query';
import {
  BookMarked,
  BookOpen,
  BrainCircuit,
  ChevronsUpDown,
  Ear,
  Flame,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  NotebookPen,
  Settings,
  Shapes,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../features/auth/use-auth';
import { fetchDashboard, fetchHistory } from '../features/content/api';
import { ImmersionProvider } from '../features/content/immersion-context';
import { computeStreak } from '../lib/progress';
import { getStoredTheme, toggleTheme } from '../lib/theme';

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard },
  { to: '/etude', label: 'Étudier', icon: NotebookPen },
  { to: '/conversation', label: 'Conversation', short: 'Parler', icon: MessageCircle },
  { to: '/shadowing', label: 'Shadowing', short: 'Écho', icon: Ear },
  { to: '/quiz-ia', label: 'Quiz IA', short: 'Quiz IA', icon: BrainCircuit },
  { to: '/lecture', label: 'Lecture', icon: BookOpen },
  { to: '/carnet', label: 'Carnet', icon: BookMarked },
  { to: '/kanji', label: 'Kanji', icon: Shapes },
  { to: '/progression', label: 'Progression', icon: TrendingUp },
] as const;

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink
      to="/"
      className="flex items-center gap-2.5 rounded-lg"
      aria-label="KanjiPath — accueil"
    >
      <span className="font-jp flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-glow">
        漢
      </span>
      {!compact ? (
        <span className="text-lg font-bold tracking-tight text-ink">
          Kanji<span className="text-accent">Path</span>
        </span>
      ) : null}
    </NavLink>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(getStoredTheme());

  const dashboard = useQuery({ queryKey: ['progress', 'dashboard'], queryFn: fetchDashboard });
  const history = useQuery({ queryKey: ['progress', 'history'], queryFn: fetchHistory });

  const totalDue = dashboard.data?.levels.reduce((sum, level) => sum + level.dueToday, 0) ?? 0;
  const streak = history.data ? computeStreak(history.data.days) : null;

  const pathname = location.pathname;
  useEffect(() => {
    if (pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname]);

  function onLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate('/login') });
  }

  const user = me.data?.user;

  const userMenu = (
    <Dropdown
      align="start"
      trigger={
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5 text-left transition-colors hover:border-line-strong"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            {user ? user.displayName.slice(0, 1).toUpperCase() : '?'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">
              {user?.displayName ?? '…'}
            </span>
            <span className="block truncate text-xs text-muted">{user?.email ?? ''}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted" />
        </button>
      }
    >
      {user ? <DropdownLabel>{user.email}</DropdownLabel> : null}
      <DropdownItem icon={<Settings />} onSelect={() => navigate('/parametres')}>
        Préférences
      </DropdownItem>
      <DropdownItem icon={<BookMarked />} onSelect={() => navigate('/sources')}>
        Sources & licences
      </DropdownItem>
      <DropdownItem
        icon={theme === 'dark' ? <Sun /> : <Moon />}
        onSelect={() => setTheme(toggleTheme())}
      >
        {theme === 'dark' ? 'Thème washi (clair)' : 'Thème encre (sombre)'}
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem icon={<LogOut />} danger onSelect={onLogout} disabled={logout.isPending}>
        Se déconnecter
      </DropdownItem>
    </Dropdown>
  );

  const mobileUserMenu = (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          aria-label="Menu utilisateur"
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
        >
          {user ? user.displayName.slice(0, 1).toUpperCase() : '?'}
        </button>
      }
    >
      {user ? <DropdownLabel>{user.displayName}</DropdownLabel> : null}
      <DropdownItem icon={<Settings />} onSelect={() => navigate('/parametres')}>
        Préférences
      </DropdownItem>
      <DropdownItem icon={<BookMarked />} onSelect={() => navigate('/sources')}>
        Sources & licences
      </DropdownItem>
      <DropdownItem
        icon={theme === 'dark' ? <Sun /> : <Moon />}
        onSelect={() => setTheme(toggleTheme())}
      >
        {theme === 'dark' ? 'Thème washi (clair)' : 'Thème encre (sombre)'}
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem icon={<LogOut />} danger onSelect={onLogout} disabled={logout.isPending}>
        Se déconnecter
      </DropdownItem>
    </Dropdown>
  );

  return (
    <ToastProvider>
      <TooltipProvider>
        <ImmersionProvider>
          <div className="min-h-dvh">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
              <div className="flex h-16 items-center px-5">
                <Wordmark />
              </div>
              <nav
                aria-label="Navigation principale"
                className="flex flex-1 flex-col gap-1 px-3 pt-2"
              >
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 ${
                          isActive
                            ? 'bg-accent-soft text-accent'
                            : 'text-muted hover:bg-surface-2 hover:text-ink'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            aria-hidden
                            className={`absolute inset-y-2 left-0 w-1 rounded-full transition-all duration-200 ${
                              isActive ? 'bg-accent opacity-100' : 'opacity-0'
                            }`}
                          />
                          <Icon aria-hidden className="size-4.5 shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.to === '/etude' && totalDue > 0 ? (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                              {totalDue}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
              <div className="flex flex-col gap-3 border-t border-line p-3">
                {streak && streak.days > 0 ? (
                  <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[0.8125rem] font-semibold text-ink-soft">
                    <Flame aria-hidden className="size-4 text-accent-2" />
                    Série de {streak.days} jour{streak.days > 1 ? 's' : ''}
                    {!streak.activeToday ? ' — à confirmer aujourd’hui' : ''}
                  </p>
                ) : null}
                {userMenu}
                <p className="px-1 text-[0.6875rem] leading-relaxed text-muted">
                  Parcours aligné sur le JLPT — listes non officielles.
                </p>
              </div>
            </aside>

            <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-lg lg:hidden">
              <Wordmark compact />
              <div className="flex items-center gap-2">
                {streak && streak.days > 0 ? (
                  <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-soft">
                    <Flame aria-hidden className="size-3.5 text-accent-2" />
                    {streak.days}
                    <span className="sr-only">jours d'étude consécutifs</span>
                  </span>
                ) : null}
                <IconButton
                  size="sm"
                  aria-label={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
                  onClick={() => setTheme(toggleTheme())}
                >
                  {theme === 'dark' ? (
                    <Sun aria-hidden className="size-4.5" />
                  ) : (
                    <Moon aria-hidden className="size-4.5" />
                  )}
                </IconButton>
                {mobileUserMenu}
              </div>
            </header>

            <div className="lg:pl-64">
              <main className="w-full px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Suspense
                      fallback={
                        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
                          <span
                            role="status"
                            aria-label="Chargement de la page"
                            className="size-7 animate-spin rounded-full border-2 border-line border-t-accent"
                          />
                        </div>
                      }
                    >
                      {children}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>

            <nav
              aria-label="Navigation principale mobile"
              className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
            >
              <div className="grid grid-cols-9">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors ${
                          isActive ? 'text-accent' : 'text-muted'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative">
                            <Icon aria-hidden className="size-5" />
                            {item.to === '/etude' && totalDue > 0 ? (
                              <span
                                aria-hidden
                                className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-white"
                              >
                                {totalDue}
                              </span>
                            ) : null}
                          </span>
                          <span className="max-w-full truncate px-0.5">
                            {'short' in item ? item.short : item.label}
                          </span>
                          <span
                            aria-hidden
                            className={`h-1 w-1 rounded-full transition-opacity ${
                              isActive ? 'bg-accent opacity-100' : 'opacity-0'
                            }`}
                          />
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </nav>
          </div>
        </ImmersionProvider>
      </TooltipProvider>
    </ToastProvider>
  );
}
