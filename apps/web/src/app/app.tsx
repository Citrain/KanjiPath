import { MotionConfig } from 'motion/react';
import { lazy, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { RegisterPage } from '../features/auth/register-page';
import { useMe } from '../features/auth/use-auth';
import { DashboardPage } from '../features/dashboard/dashboard-page';
import { AppLayout } from './app-layout';

const KanjiListPage = lazy(() =>
  import('../features/kanji/kanji-list-page').then((m) => ({ default: m.KanjiListPage })),
);
const KanjiCardPage = lazy(() =>
  import('../features/kanji/kanji-card-page').then((m) => ({ default: m.KanjiCardPage })),
);
const WritingPage = lazy(() =>
  import('../features/kanji/writing-page').then((m) => ({ default: m.WritingPage })),
);
const ProgressionPage = lazy(() =>
  import('../features/progression/progression-page').then((m) => ({ default: m.ProgressionPage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/settings-page').then((m) => ({ default: m.SettingsPage })),
);
const SourcesPage = lazy(() =>
  import('../features/sources/sources-page').then((m) => ({ default: m.SourcesPage })),
);
const SessionPage = lazy(() =>
  import('../features/study/session-page').then((m) => ({ default: m.SessionPage })),
);

function AuthSplash() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5">
      <span aria-hidden className="font-jp animate-float text-6xl font-bold text-accent">
        漢
      </span>
      <span
        role="status"
        aria-label="Chargement en cours"
        className="size-7 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      <p className="text-sm font-semibold tracking-widest text-muted">CHARGEMENT…</p>
    </main>
  );
}

function RequireAuth({ children }: { children: ReactElement }) {
  const me = useMe();
  if (me.isPending) {
    return <AuthSplash />;
  }
  if (me.isError) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function Protected({ children }: { children: ReactElement }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <Protected>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/kanji"
            element={
              <Protected>
                <KanjiListPage />
              </Protected>
            }
          />
          <Route
            path="/kanji/:literal"
            element={
              <Protected>
                <KanjiCardPage />
              </Protected>
            }
          />
          <Route
            path="/kanji/:literal/ecriture"
            element={
              <Protected>
                <WritingPage />
              </Protected>
            }
          />
          <Route
            path="/etude"
            element={
              <Protected>
                <SessionPage />
              </Protected>
            }
          />
          <Route
            path="/progression"
            element={
              <Protected>
                <ProgressionPage />
              </Protected>
            }
          />
          <Route
            path="/sources"
            element={
              <Protected>
                <SourcesPage />
              </Protected>
            }
          />
          <Route
            path="/parametres"
            element={
              <Protected>
                <SettingsPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
