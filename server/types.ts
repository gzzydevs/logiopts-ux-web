// Shared types between server and client — Solaar-based

// ─── Device Model ────────────────────────────────────────────────────────────

export interface KnownDevice {
  displayName: string;
  /** Device name as reported by Solaar (e.g. "LIFT VERTICAL ERGONOMIC MOUSE") */
  solaarName: string;
  /** Unique device identifier from Solaar (unit ID or serial) */
  unitId: string;
  pid: number;
  buttons: KnownButton[];
  maxDpi: number;
  minDpi: number;
  dpiStep: number;
  svgId: string;
  /** Battery percentage (from Solaar), -1 if unknown */
  battery: number;
}

export interface KnownButton {
  cid: number;
  name: string;
  /** Solaar name for this button (e.g. "DPI Switch", "Back Button") */
  solaarName: string;
  /** Can be diverted to produce HID++ notifications */
  divertable: boolean;
  /** Supports raw XY tracking (required for mouse gestures) */
  rawXy: boolean;
  reprogrammable: boolean;
  /** SVG overlay position */
  position: string;
  /** Layout X position in % (0..100) relative to mouse canvas — set by layout editor */
  layoutX?: number;
  /** Layout Y position in % (0..100) relative to mouse canvas — set by layout editor */
  layoutY?: number;
  /** Manual label side override — set by layout editor */
  labelSide?: 'left' | 'right';
}

// ─── Solaar Configuration Model ──────────────────────────────────────────────

/** The full config we send to the server for apply */
export interface SolaarConfig {
  deviceName: string;
  unitId: string;
  dpi: number;
  /** Map of button CID → diversion mode (0=Regular, 1=Diverted, 2=Mouse Gestures) */
  divertKeys: Record<number, 0 | 1 | 2>;
  /** Gesture rules to write to rules.yaml */
  rules: SolaarRule[];
}

// ─── Solaar Rules ────────────────────────────────────────────────────────────

export interface SolaarRule {
  /** Optional comment */
  comment?: string;
  condition: SolaarCondition;
  action: SolaarAction;
}

export type SolaarCondition =
  | { type: 'MouseGesture'; directions: string[] }  // [] = click, ['Mouse Up'], etc.
  | { type: 'Key'; key: string; event?: 'pressed' | 'released' };

export type SolaarAction =
  | { type: 'None' }
  | { type: 'KeyPress'; keys: string[] }       // X11 keysyms: ['Control_L', 'Tab']
  | { type: 'MouseClick'; button: 'left' | 'middle' | 'right'; count: number | 'click' }
  | { type: 'MouseScroll'; horizontal: number; vertical: number }
  | { type: 'Execute'; command: string[] }      // ['pactl', 'set-sink-volume', ...]
  | { type: 'RunScript'; scriptId: string; macroKey?: string }; // Run local script via Solaar Execute

// ─── Action used in the UI gesture grid ──────────────────────────────────────

export type GestureDirection = 'None' | 'Up' | 'Down' | 'Left' | 'Right';

export interface GestureSlotConfig {
  direction: GestureDirection;
  action: SolaarAction;
}

/** Button config as the UI sees it (before converting to SolaarRule[]) */
export interface ButtonConfig {
  cid: number;
  /** Whether this button uses gesture mode */
  gestureMode: boolean;
  /** Actions per direction (when gestureMode = true) */
  gestures: Record<GestureDirection, SolaarAction>;
  /** Single action (when gestureMode = false, i.e. simple divert + rule) */
  simpleAction: SolaarAction;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

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

// ─── System Actions ──────────────────────────────────────────────────────────

export type SystemActionCategory = 'media' | 'volume' | 'brightness' | 'system';

export interface SystemAction {
  id: string;
  label: string;
  description: string;
  /** Solaar action (KeyPress with X11 keysyms, or Execute with command) */
  action: SolaarAction;
  category: SystemActionCategory;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ─── Solaar Status ───────────────────────────────────────────────────────────

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
  preferences: Record<string, string>;
  activeProfileId: string | null;
}
