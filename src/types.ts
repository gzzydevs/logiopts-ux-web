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
  /** True when the device was seen in the latest Solaar scan (runtime-only, not persisted) */
  connected?: boolean;
}

export interface KnownButton {
  cid: number;
  name: string;
  solaarName: string;
  divertable: boolean;
  rawXy: boolean;
  reprogrammable: boolean;
  position: string;
  /** Layout X position in % (0..100) relative to mouse canvas */
  layoutX?: number;
  /** Layout Y position in % (0..100) relative to mouse canvas */
  layoutY?: number;
  /** Manual label side override — set by layout editor */
  labelSide?: 'left' | 'right';
}

export type GestureDirection = 'None' | 'Up' | 'Down' | 'Left' | 'Right';

export type SolaarAction =
  | { type: 'None' }
  | { type: 'KeyPress'; keys: string[] }
  | { type: 'MouseClick'; button: 'left' | 'middle' | 'right'; count: number | 'click' }
  | { type: 'MouseScroll'; horizontal: number; vertical: number }
  | { type: 'Execute'; command: string[] }
  | { type: 'RunScript'; script: string; macroKey?: string };

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

export interface Script {
  id: string;
  name: string;
  path: string;
  content: string;
  executable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BootstrapData {
  devices: KnownDevice[];
  profiles: Profile[];
  configs: { profileId: string; yamlConfig: string; appliedAt: string | null }[];
  scripts: Script[];
  preferences: Record<string, string>;
  activeProfileId: string | null;
  /** Unit IDs of devices currently visible to Solaar (connected & detected) */
  connectedDeviceIds: string[];
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export type SolaarInstallType = 'flatpak' | 'system' | 'none';

export interface SolaarStatus {
  installed: boolean;
  installType: SolaarInstallType;
  running: boolean;
  configDir: string;
  version: string;
}
