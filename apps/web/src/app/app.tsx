import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { RegisterPage } from '../features/auth/register-page';
import { useMe } from '../features/auth/use-auth';
import { DashboardPage } from '../features/dashboard/dashboard-page';
import { KanjiCardPage } from '../features/kanji/kanji-card-page';
import { KanjiListPage } from '../features/kanji/kanji-list-page';
import { SettingsPage } from '../features/settings/settings-page';
import { SourcesPage } from '../features/sources/sources-page';
import { SessionPage } from '../features/study/session-page';
import { AppLayout } from './app-layout';

function RequireAuth({ children }: { children: ReactElement }) {
  const me = useMe();
  if (me.isPending) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <span className="font-kanji animate-float text-glow text-7xl text-accent">漢</span>
        <p className="text-sm font-semibold tracking-widest text-muted">CHARGEMENT…</p>
      </main>
    );
  }
  if (me.isError) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/kanji"
          element={
            <RequireAuth>
              <AppLayout>
                <KanjiListPage />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/kanji/:literal"
          element={
            <RequireAuth>
              <AppLayout>
                <KanjiCardPage />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/etude"
          element={
            <RequireAuth>
              <AppLayout>
                <SessionPage />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/sources"
          element={
            <RequireAuth>
              <AppLayout>
                <SourcesPage />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/parametres"
          element={
            <RequireAuth>
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
