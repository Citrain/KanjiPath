import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { RegisterPage } from '../features/auth/register-page';
import { useMe } from '../features/auth/use-auth';
import { DashboardPage } from '../features/dashboard/dashboard-page';

function RequireAuth({ children }: { children: ReactElement }) {
  const me = useMe();
  if (me.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Chargement…
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
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
