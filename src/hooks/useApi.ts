import type {
  ApiResponse,
  KnownDevice,
  SolaarConfig,
  SolaarStatus,
  SolaarInstallType,
  ButtonConfig,
  SystemAction,
  Profile,
  SolaarRule,
  BootstrapData,
} from '../types';

const BASE = '/api';

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data as T;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export function fetchBootstrap(): Promise<BootstrapData> {
  return api<BootstrapData>('/bootstrap');
}

// ─── Device ──────────────────────────────────────────────────────────────────

export interface DeviceResponse {
  device: KnownDevice;
  dpi: number;
  divertKeys: Record<string, number>;
  installType: SolaarInstallType;
  configDir: string;
}

export function fetchDevice(): Promise<DeviceResponse> {
  return api<DeviceResponse>('/device');
}

export function fetchDeviceStatus(): Promise<SolaarStatus> {
  return api<SolaarStatus>('/device/status');
}

export function fetchSystemActions(): Promise<SystemAction[]> {
  return api<SystemAction[]>('/device/system-actions');
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ConfigResponse {
  configYaml: string;
  rulesYaml: string;
  rules: SolaarRule[];
  configDir: string;
  installType: SolaarInstallType;
}

export function fetchConfig(): Promise<ConfigResponse> {
  return api<ConfigResponse>('/config');
}

export function applyConfig(
  solaarConfig: SolaarConfig,
  buttons: ButtonConfig[],
  _profileId?: string,
): Promise<{ output: string }> {
  return api<{ output: string }>('/config', {
    method: 'POST',
    body: JSON.stringify({ solaarConfig, buttons }),
  });
}

export function saveConfigToDB(body: {
  buttons: ButtonConfig[];
  profileId: string;
  deviceId: string;
  profileName: string;
}): Promise<{ yamlConfig: string; persisted: boolean }> {
  return api<{ yamlConfig: string; persisted: boolean }>('/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function resetConfig(): Promise<{ output: string }> {
  return api<{ output: string }>('/config/reset', { method: 'POST' });
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export function fetchProfiles(): Promise<Profile[]> {
  return api<Profile[]>('/profiles');
}

export function saveProfile(profile: Profile): Promise<Profile> {
  return api<Profile>('/profiles', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

export function deleteProfile(id: string): Promise<void> {
  return api<void>(`/profiles/${id}`, { method: 'DELETE' });
}

// ─── Actions (script runner) ─────────────────────────────────────────────────

export function runAction(script: string, args: string[] = []): Promise<{ output: string }> {
  return api<{ output: string }>(`/actions/${script}`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });
}

// ─── Device Layout ───────────────────────────────────────────────────────────

export function saveDeviceLayout(
  deviceId: string,
  layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>,
): Promise<{ saved: boolean }> {
  return api<{ saved: boolean }>(`/device/${deviceId}/layout`, {
    method: 'PUT',
    body: JSON.stringify({ layout }),
  });
}
