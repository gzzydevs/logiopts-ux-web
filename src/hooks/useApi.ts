import type { KnownDevice, SystemAction, LogidConfig, Profile, ApiResponse } from '../types';

const BASE = '/api';

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data as T;
}

export function getDevice() {
  return fetchJson<KnownDevice>('/device');
}

export function getSystemActions() {
  return fetchJson<SystemAction[]>('/system-actions');
}

export function getConfig() {
  return fetchJson<{ raw: string }>('/config');
}

export function applyConfig(config: LogidConfig) {
  return fetchJson<{ applied: boolean; config: string }>('/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export function resetConfig(deviceName: string, dpi: number) {
  return fetchJson<{ reset: boolean }>('/config/reset', {
    method: 'POST',
    body: JSON.stringify({ deviceName, dpi }),
  });
}

export function getProfiles() {
  return fetchJson<Profile[]>('/profiles');
}

export function saveProfile(profile: Profile) {
  return fetchJson<Profile>('/profiles', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

export function deleteProfile(id: string) {
  return fetchJson<void>(`/profiles/${id}`, { method: 'DELETE' });
}

export function runAction(script: string, args: string[] = []) {
  return fetchJson<{ output: string }>(`/actions/${script}`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });
}
