const API_BASE = '/api/v1';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(`Erreur API ${status}`);
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfPromise: Promise<void> | null = null;

async function ensureCsrf(): Promise<void> {
  if (readCookie('kp_csrf')) {
    return;
  }
  if (!csrfPromise) {
    csrfPromise = fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' }).then(() => undefined);
  }
  await csrfPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body !== undefined && init.body !== null) {
    headers['content-type'] = headers['content-type'] ?? 'application/json';
  }
  if (method !== 'GET' && method !== 'HEAD') {
    await ensureCsrf();
    const token = readCookie('kp_csrf');
    if (token) {
      headers['x-csrf-token'] = token;
    }
  }
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiRequestError(response.status, payload);
  }
  return payload as T;
}
