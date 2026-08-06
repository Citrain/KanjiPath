import type { ApiAuthResponse, ApiHealth } from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function fetchMe(): Promise<ApiAuthResponse> {
  return apiFetch<ApiAuthResponse>('/auth/me');
}

export function fetchHealth(): Promise<ApiHealth> {
  return apiFetch<ApiHealth>('/health');
}

export function registerUser(payload: RegisterPayload): Promise<ApiAuthResponse> {
  return apiFetch<ApiAuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginPayload): Promise<ApiAuthResponse> {
  return apiFetch<ApiAuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutUser(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}
