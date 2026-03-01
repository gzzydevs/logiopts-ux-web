// Shared types between server and client

// ─── Device Database ─────────────────────────────────────────────────────────

export interface KnownDevice {
  displayName: string;
  logidName: string;
  pid: number;
  buttons: KnownButton[];
  hasSmartshift: boolean;
  hasThumbwheel: boolean;
  hasHiresscroll: boolean;
  maxDpi: number;
  minDpi: number;
  dpiStep: number;
  maxHosts: number;
  svgId: string;
}

export interface KnownButton {
  cid: number;
  name: string;
  supportsGestures: boolean;
  reprogrammable: boolean;
  position: string;
}

// ─── Configuration Model (maps to logid.cfg) ────────────────────────────────

export interface LogidConfig {
  devices: DeviceConfig[];
}

export interface DeviceConfig {
  name: string;
  dpi?: number;
  smartshift?: SmartShiftConfig;
  hiresscroll?: HiResScrollConfig;
  buttons: ButtonConfig[];
}

export interface SmartShiftConfig {
  on?: boolean;
  threshold?: number;
  defaultThreshold?: number;
}

export interface HiResScrollConfig {
  hires?: boolean;
  invert?: boolean;
  target?: boolean;
}

export interface ButtonConfig {
  cid: number;
  action: Action;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'None' }
  | { type: 'Keypress'; keys: string[] }
  | { type: 'Gestures'; gestures: GestureConfig[] }
  | { type: 'ToggleSmartShift' }
  | { type: 'ToggleHiresScroll' }
  | { type: 'CycleDPI'; dpis: number[] }
  | { type: 'ChangeDPI'; inc: number }
  | { type: 'ChangeHost'; host: string | number };

export interface GestureConfig {
  direction: 'None' | 'Up' | 'Down' | 'Left' | 'Right';
  mode?: 'OnRelease' | 'OnThreshold' | 'OnInterval' | 'OnFewPixels';
  threshold?: number;
  action: Action;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  deviceLogidName: string;
  dpi?: number;
  smartshift?: SmartShiftConfig;
  hiresscroll?: HiResScrollConfig;
  buttons: ButtonConfig[];
  createdAt: string;
  updatedAt: string;
}

// ─── System Actions ──────────────────────────────────────────────────────────

export type SystemActionId =
  | 'volume-up'
  | 'volume-down'
  | 'volume-mute'
  | 'brightness-up'
  | 'brightness-down'
  | 'nightshift-toggle'
  | 'open-browser'
  | 'play-pause'
  | 'next-track'
  | 'prev-track';

export interface SystemAction {
  id: SystemActionId;
  label: string;
  description: string;
  keys: string[];
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
