import type { SettingsDto } from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function fetchSettings(): Promise<SettingsDto> {
  return apiFetch<SettingsDto>('/settings');
}

export function updateSettings(patch: Partial<SettingsDto>): Promise<SettingsDto> {
  return apiFetch<SettingsDto>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
