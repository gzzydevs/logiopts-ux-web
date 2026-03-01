// Frontend types — mirrors server/types.ts

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

export interface ButtonConfig {
  cid: number;
  action: Action;
}

export interface DeviceConfig {
  name: string;
  dpi?: number;
  buttons: ButtonConfig[];
}

export interface LogidConfig {
  devices: DeviceConfig[];
}

export interface SystemAction {
  id: string;
  label: string;
  description: string;
  keys: string[];
}

export interface Profile {
  id: string;
  name: string;
  deviceLogidName: string;
  dpi?: number;
  buttons: ButtonConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
