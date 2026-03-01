import type { KnownDevice, SystemAction } from '../types.js';

/**
 * Logitech Lift CID table (from `logid -v debug`):
 *   0x50 Left Click       - not reprog
 *   0x51 Right Click      - not reprog
 *   0x52 Middle Click     - reprog, gestures   (scroll wheel click)
 *   0x53 Back             - reprog, gestures   (bottom side button)
 *   0x56 Forward          - reprog, gestures   (top side button)
 *   0xd7 Top Button       - reprog, gestures   (button below scroll wheel)
 *   0xfd Extra Button     - reprog, gestures   (internal/function)
 */
const logitechLift: KnownDevice = {
  displayName: 'Logitech Lift',
  logidName: 'LIFT VERTICAL ERGONOMIC MOUSE',
  pid: 0xb031,
  buttons: [
    {
      cid: 0x0050,
      name: 'Left Click',
      supportsGestures: false,
      reprogrammable: false,
      position: 'left-main',
    },
    {
      cid: 0x0051,
      name: 'Right Click',
      supportsGestures: false,
      reprogrammable: false,
      position: 'right-main',
    },
    {
      cid: 0x0052,
      name: 'Scroll Click',
      supportsGestures: true,
      reprogrammable: true,
      position: 'middle',
    },
    {
      cid: 0x0053,
      name: 'Back',
      supportsGestures: true,
      reprogrammable: true,
      position: 'side-back',
    },
    {
      cid: 0x0056,
      name: 'Forward',
      supportsGestures: true,
      reprogrammable: true,
      position: 'side-front',
    },
    {
      cid: 0x00d7,
      name: 'Top Button',
      supportsGestures: true,
      reprogrammable: true,
      position: 'top',
    },
  ],
  hasSmartshift: false,
  hasThumbwheel: false,
  hasHiresscroll: true,
  maxDpi: 4000,
  minDpi: 400,
  dpiStep: 100,
  maxHosts: 3,
  svgId: 'lift',
};

// ─── All known devices ───────────────────────────────────────────────────────

export const KNOWN_DEVICES: KnownDevice[] = [logitechLift];

export function findDeviceByLogidName(name: string): KnownDevice | undefined {
  return KNOWN_DEVICES.find((d) => d.logidName === name);
}

// ─── System actions (mapped to XF86 keycodes that KDE handles natively) ─────

export const SYSTEM_ACTIONS: SystemAction[] = [
  { id: 'volume-up', label: 'Volume Up', description: 'Increase volume', keys: ['KEY_VOLUMEUP'] },
  { id: 'volume-down', label: 'Volume Down', description: 'Decrease volume', keys: ['KEY_VOLUMEDOWN'] },
  { id: 'volume-mute', label: 'Mute', description: 'Toggle mute', keys: ['KEY_MUTE'] },
  { id: 'brightness-up', label: 'Brightness Up', description: 'Increase brightness', keys: ['KEY_BRIGHTNESSUP'] },
  { id: 'brightness-down', label: 'Brightness Down', description: 'Decrease brightness', keys: ['KEY_BRIGHTNESSDOWN'] },
  { id: 'nightshift-toggle', label: 'Night Light', description: 'Toggle night mode', keys: ['KEY_LEFTCTRL', 'KEY_LEFTALT', 'KEY_N'] },
  { id: 'open-browser', label: 'Browser', description: 'Open default browser', keys: ['KEY_HOMEPAGE'] },
  { id: 'play-pause', label: 'Play/Pause', description: 'Media play/pause', keys: ['KEY_PLAYPAUSE'] },
  { id: 'next-track', label: 'Next Track', description: 'Next media track', keys: ['KEY_NEXTSONG'] },
  { id: 'prev-track', label: 'Prev Track', description: 'Previous media track', keys: ['KEY_PREVIOUSSONG'] },
];

// ─── Browser KeyboardEvent.code → Linux key name ────────────────────────────

export const BROWSER_TO_LINUX: Record<string, string> = {
  KeyA: 'KEY_A', KeyB: 'KEY_B', KeyC: 'KEY_C', KeyD: 'KEY_D',
  KeyE: 'KEY_E', KeyF: 'KEY_F', KeyG: 'KEY_G', KeyH: 'KEY_H',
  KeyI: 'KEY_I', KeyJ: 'KEY_J', KeyK: 'KEY_K', KeyL: 'KEY_L',
  KeyM: 'KEY_M', KeyN: 'KEY_N', KeyO: 'KEY_O', KeyP: 'KEY_P',
  KeyQ: 'KEY_Q', KeyR: 'KEY_R', KeyS: 'KEY_S', KeyT: 'KEY_T',
  KeyU: 'KEY_U', KeyV: 'KEY_V', KeyW: 'KEY_W', KeyX: 'KEY_X',
  KeyY: 'KEY_Y', KeyZ: 'KEY_Z',
  Digit0: 'KEY_0', Digit1: 'KEY_1', Digit2: 'KEY_2', Digit3: 'KEY_3',
  Digit4: 'KEY_4', Digit5: 'KEY_5', Digit6: 'KEY_6', Digit7: 'KEY_7',
  Digit8: 'KEY_8', Digit9: 'KEY_9',
  F1: 'KEY_F1', F2: 'KEY_F2', F3: 'KEY_F3', F4: 'KEY_F4',
  F5: 'KEY_F5', F6: 'KEY_F6', F7: 'KEY_F7', F8: 'KEY_F8',
  F9: 'KEY_F9', F10: 'KEY_F10', F11: 'KEY_F11', F12: 'KEY_F12',
  ControlLeft: 'KEY_LEFTCTRL', ControlRight: 'KEY_RIGHTCTRL',
  ShiftLeft: 'KEY_LEFTSHIFT', ShiftRight: 'KEY_RIGHTSHIFT',
  AltLeft: 'KEY_LEFTALT', AltRight: 'KEY_RIGHTALT',
  MetaLeft: 'KEY_LEFTMETA', MetaRight: 'KEY_RIGHTMETA',
  Tab: 'KEY_TAB', Escape: 'KEY_ESC', Enter: 'KEY_ENTER',
  Space: 'KEY_SPACE', Backspace: 'KEY_BACKSPACE', Delete: 'KEY_DELETE',
  ArrowUp: 'KEY_UP', ArrowDown: 'KEY_DOWN',
  ArrowLeft: 'KEY_LEFT', ArrowRight: 'KEY_RIGHT',
  Home: 'KEY_HOME', End: 'KEY_END',
  PageUp: 'KEY_PAGEUP', PageDown: 'KEY_PAGEDOWN',
  Insert: 'KEY_INSERT', PrintScreen: 'KEY_SYSRQ',
  Minus: 'KEY_MINUS', Equal: 'KEY_EQUAL',
  BracketLeft: 'KEY_LEFTBRACE', BracketRight: 'KEY_RIGHTBRACE',
  Backslash: 'KEY_BACKSLASH', Semicolon: 'KEY_SEMICOLON',
  Quote: 'KEY_APOSTROPHE', Backquote: 'KEY_GRAVE',
  Comma: 'KEY_COMMA', Period: 'KEY_DOT', Slash: 'KEY_SLASH',
};

export function keyDisplayName(linuxKey: string): string {
  const map: Record<string, string> = {
    KEY_LEFTCTRL: 'Ctrl', KEY_RIGHTCTRL: 'Ctrl',
    KEY_LEFTSHIFT: 'Shift', KEY_RIGHTSHIFT: 'Shift',
    KEY_LEFTALT: 'Alt', KEY_RIGHTALT: 'Alt',
    KEY_LEFTMETA: 'Super', KEY_RIGHTMETA: 'Super',
    KEY_ESC: 'Esc', KEY_TAB: 'Tab', KEY_ENTER: 'Enter',
    KEY_SPACE: 'Space', KEY_BACKSPACE: 'Bksp', KEY_DELETE: 'Del',
    KEY_UP: '↑', KEY_DOWN: '↓', KEY_LEFT: '←', KEY_RIGHT: '→',
    KEY_PAGEUP: 'PgUp', KEY_PAGEDOWN: 'PgDn',
    KEY_HOME: 'Home', KEY_END: 'End',
    KEY_VOLUMEUP: 'Vol+', KEY_VOLUMEDOWN: 'Vol-', KEY_MUTE: 'Mute',
    KEY_PLAYPAUSE: '⏯', KEY_NEXTSONG: '⏭', KEY_PREVIOUSSONG: '⏮',
    KEY_HOMEPAGE: '🌐', KEY_BRIGHTNESSUP: '🔆', KEY_BRIGHTNESSDOWN: '🔅',
    KEY_SYSRQ: 'PrtSc', KEY_INSERT: 'Ins',
  };
  return map[linuxKey] ?? linuxKey.replace('KEY_', '');
}
