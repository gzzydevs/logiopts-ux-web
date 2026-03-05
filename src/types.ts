// Frontend types — mirrors server/types.ts (Solaar-based)

export interface KnownDevice {
  displayName: string;
  solaarName: string;
  unitId: string;
  pid: number;
  buttons: KnownButton[];
  maxDpi: number;
  minDpi: number;
  dpiStep: number;
  svgId: string;
  battery: number;
}

export interface KnownButton {
  cid: number;
  name: string;
  solaarName: string;
  divertable: boolean;
  rawXy: boolean;
  reprogrammable: boolean;
  position: string;
}

export type GestureDirection = 'None' | 'Up' | 'Down' | 'Left' | 'Right';

export type SolaarAction =
  | { type: 'None' }
  | { type: 'KeyPress'; keys: string[] }
  | { type: 'MouseClick'; button: 'left' | 'middle' | 'right'; count: number | 'click' }
  | { type: 'MouseScroll'; horizontal: number; vertical: number }
  | { type: 'Execute'; command: string[] }
  | { type: 'RunScript'; script: string; macroKey?: string }; // Map to macroKey. Uses backend to execute scripts

export interface SolaarRule {
  comment?: string;
  condition: SolaarCondition;
  action: SolaarAction;
}

export type SolaarCondition =
  | { type: 'MouseGesture'; directions: string[] }
  | { type: 'Key'; key: string; event?: 'pressed' | 'released' };

export interface SolaarConfig {
  deviceName: string;
  unitId: string;
  dpi: number;
  divertKeys: Record<number, 0 | 1 | 2>;
  rules: SolaarRule[];
}

export interface ButtonConfig {
  cid: number;
  gestureMode: boolean;
  gestures: Record<GestureDirection, SolaarAction>;
  simpleAction: SolaarAction;
}

export interface SystemAction {
  id: string;
  label: string;
  description: string;
  action: SolaarAction;
  category: 'media' | 'volume' | 'brightness' | 'system';
}

export interface Profile {
  id: string;
  name: string;
  deviceName: string;
  dpi?: number;
  buttons: ButtonConfig[];
  windowClasses?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type SolaarInstallType = 'flatpak' | 'system' | 'none';

export interface SolaarStatus {
  installed: boolean;
  installType: SolaarInstallType;
  running: boolean;
  configDir: string;
  version: string;
}

// ─── Script (DB-backed) ──────────────────────────────────────────────────────

export interface Script {
  id: string;
  name: string;
  path: string;
  content: string;
  executable: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Bootstrap (initial load) ────────────────────────────────────────────────

export interface BootstrapData {
  devices: KnownDevice[];
  profiles: Profile[];
  configs: { profileId: string; yamlConfig: string; appliedAt: string | null }[];
  scripts: Script[];
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
