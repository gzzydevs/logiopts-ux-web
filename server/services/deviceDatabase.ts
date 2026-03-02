/**
 * Local device database — enriches auto-detected data from `solaar show`
 * with SVG positions, display names, and known CID→button mappings.
 */
import type { KnownDevice, KnownButton, SystemAction } from '../types.js';

// ─── Known CID Map (Logitech HID++ CIDs, decimal) ──────────────────────────

export const CID_MAP: Record<number, Omit<KnownButton, 'cid' | 'divertable' | 'rawXy' | 'reprogrammable'>> = {
  80:  { name: 'Left Click',      solaarName: 'Left Button',       position: 'left' },
  81:  { name: 'Right Click',     solaarName: 'Right Button',      position: 'right' },
  82:  { name: 'Middle Click',    solaarName: 'Middle Button',     position: 'middle' },
  83:  { name: 'Back',            solaarName: 'Back Button',       position: 'back' },
  86:  { name: 'Forward',         solaarName: 'Forward Button',    position: 'forward' },
  195: { name: 'Smart Shift',     solaarName: 'Smart Shift',       position: 'scrollMode' },
  215: { name: 'Scroll Left',     solaarName: 'Scroll Left Button', position: 'scrollLeft' },
  216: { name: 'Scroll Right',    solaarName: 'Scroll Right Button', position: 'scrollRight' },
  253: { name: 'DPI Switch',      solaarName: 'DPI Switch',        position: 'dpiSwitch' },
};

// ─── Browser key → X11 keysym mapping ───────────────────────────────────────

export const BROWSER_TO_X11KEYSYM: Record<string, string> = {
  // Letters
  KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e',
  KeyF: 'f', KeyG: 'g', KeyH: 'h', KeyI: 'i', KeyJ: 'j',
  KeyK: 'k', KeyL: 'l', KeyM: 'm', KeyN: 'n', KeyO: 'o',
  KeyP: 'p', KeyQ: 'q', KeyR: 'r', KeyS: 's', KeyT: 't',
  KeyU: 'u', KeyV: 'v', KeyW: 'w', KeyX: 'x', KeyY: 'y', KeyZ: 'z',
  // Digits
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  // Modifiers
  ShiftLeft: 'Shift_L', ShiftRight: 'Shift_R',
  ControlLeft: 'Control_L', ControlRight: 'Control_R',
  AltLeft: 'Alt_L', AltRight: 'Alt_R',
  MetaLeft: 'Super_L', MetaRight: 'Super_R',
  // Function keys
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  // Navigation
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'Page_Up', PageDown: 'Page_Down',
  Insert: 'Insert', Delete: 'Delete',
  // Editing
  Backspace: 'BackSpace', Tab: 'Tab', Enter: 'Return', Escape: 'Escape',
  Space: 'space',
  // Punctuation
  Comma: 'comma', Period: 'period', Slash: 'slash', Backslash: 'backslash',
  BracketLeft: 'bracketleft', BracketRight: 'bracketright',
  Semicolon: 'semicolon', Quote: 'apostrophe', Backquote: 'grave',
  Minus: 'minus', Equal: 'equal',
  // Media keys (might come from KeyboardEvent.code)
  MediaPlayPause: 'XF86AudioPlay', MediaStop: 'XF86AudioStop',
  MediaTrackPrevious: 'XF86AudioPrev', MediaTrackNext: 'XF86AudioNext',
  AudioVolumeUp: 'XF86AudioRaiseVolume', AudioVolumeDown: 'XF86AudioLowerVolume',
  AudioVolumeMute: 'XF86AudioMute',
};

/** Get a friendly display name for an X11 keysym */
export function keyDisplayName(keysym: string): string {
  const names: Record<string, string> = {
    Control_L: 'Ctrl', Control_R: 'Ctrl',
    Shift_L: 'Shift', Shift_R: 'Shift',
    Alt_L: 'Alt', Alt_R: 'Alt',
    Super_L: 'Super', Super_R: 'Super',
    Return: 'Enter', BackSpace: 'Backspace',
    space: 'Space', Escape: 'Esc',
    Page_Up: 'PgUp', Page_Down: 'PgDn',
    Up: '↑', Down: '↓', Left: '←', Right: '→',
    XF86AudioPlay: '⏯ Play', XF86AudioStop: '⏹ Stop',
    XF86AudioPrev: '⏮ Prev', XF86AudioNext: '⏭ Next',
    XF86AudioRaiseVolume: '🔊 Vol+', XF86AudioLowerVolume: '🔉 Vol-',
    XF86AudioMute: '🔇 Mute',
    Tab: 'Tab',
  };
  return names[keysym] || keysym.replace(/_/g, ' ');
}

// ─── Known Devices (local SVG/position enrichment) ──────────────────────────

export const KNOWN_DEVICES: Record<string, Partial<KnownDevice>> = {
  'LIFT VERTICAL ERGONOMIC MOUSE': {
    displayName: 'Logitech Lift',
    pid: 0x4101,
    maxDpi: 4000,
    minDpi: 400,
    dpiStep: 100,
    svgId: 'lift',
  },
  'MX Master 3': {
    displayName: 'MX Master 3',
    pid: 0x4082,
    maxDpi: 4000,
    minDpi: 200,
    dpiStep: 50,
    svgId: 'mx-master-3',
  },
  'MX Ergo': {
    displayName: 'MX Ergo',
    pid: 0x406F,
    maxDpi: 2048,
    minDpi: 512,
    dpiStep: 128,
    svgId: 'mx-ergo',
  },
  'MX Anywhere 3': {
    displayName: 'MX Anywhere 3',
    pid: 0x4090,
    maxDpi: 4000,
    minDpi: 200,
    dpiStep: 50,
    svgId: 'mx-anywhere-3',
  },
};

// ─── System Actions ─────────────────────────────────────────────────────────

export const SYSTEM_ACTIONS: SystemAction[] = [
  // Volume
  {
    id: 'vol-up',
    label: 'Volume Up',
    description: 'Increase system volume by 5%',
    action: { type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '+5%'] },
    category: 'volume',
  },
  {
    id: 'vol-down',
    label: 'Volume Down',
    description: 'Decrease system volume by 5%',
    action: { type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '-5%'] },
    category: 'volume',
  },
  {
    id: 'vol-mute',
    label: 'Toggle Mute',
    description: 'Toggle mute on default sink',
    action: { type: 'Execute', command: ['pactl', 'set-sink-mute', '@DEFAULT_SINK@', 'toggle'] },
    category: 'volume',
  },
  // Media
  {
    id: 'media-play',
    label: 'Play / Pause',
    description: 'Toggle media playback',
    action: { type: 'KeyPress', keys: ['XF86AudioPlay'] },
    category: 'media',
  },
  {
    id: 'media-next',
    label: 'Next Track',
    description: 'Skip to next track',
    action: { type: 'KeyPress', keys: ['XF86AudioNext'] },
    category: 'media',
  },
  {
    id: 'media-prev',
    label: 'Previous Track',
    description: 'Skip to previous track',
    action: { type: 'KeyPress', keys: ['XF86AudioPrev'] },
    category: 'media',
  },
  // Brightness
  {
    id: 'bright-up',
    label: 'Brightness Up',
    description: 'Increase screen brightness',
    action: { type: 'Execute', command: ['brightnessctl', 'set', '+5%'] },
    category: 'brightness',
  },
  {
    id: 'bright-down',
    label: 'Brightness Down',
    description: 'Decrease screen brightness',
    action: { type: 'Execute', command: ['brightnessctl', 'set', '5%-'] },
    category: 'brightness',
  },
  // System
  {
    id: 'copy',
    label: 'Copy',
    description: 'Ctrl+C',
    action: { type: 'KeyPress', keys: ['Control_L', 'c'] },
    category: 'system',
  },
  {
    id: 'paste',
    label: 'Paste',
    description: 'Ctrl+V',
    action: { type: 'KeyPress', keys: ['Control_L', 'v'] },
    category: 'system',
  },
  {
    id: 'undo',
    label: 'Undo',
    description: 'Ctrl+Z',
    action: { type: 'KeyPress', keys: ['Control_L', 'z'] },
    category: 'system',
  },
  {
    id: 'redo',
    label: 'Redo',
    description: 'Ctrl+Shift+Z',
    action: { type: 'KeyPress', keys: ['Control_L', 'Shift_L', 'z'] },
    category: 'system',
  },
  {
    id: 'tab-next',
    label: 'Next Tab',
    description: 'Ctrl+Tab',
    action: { type: 'KeyPress', keys: ['Control_L', 'Tab'] },
    category: 'system',
  },
  {
    id: 'tab-prev',
    label: 'Previous Tab',
    description: 'Ctrl+Shift+Tab',
    action: { type: 'KeyPress', keys: ['Control_L', 'Shift_L', 'Tab'] },
    category: 'system',
  },
  {
    id: 'middle-click',
    label: 'Middle Click',
    description: 'Emulate middle mouse button',
    action: { type: 'MouseClick', button: 'middle', count: 'click' },
    category: 'system',
  },
  {
    id: 'scroll-up',
    label: 'Scroll Up',
    description: 'Scroll wheel up',
    action: { type: 'MouseScroll', horizontal: 0, vertical: 1 },
    category: 'system',
  },
  {
    id: 'scroll-down',
    label: 'Scroll Down',
    description: 'Scroll wheel down',
    action: { type: 'MouseScroll', horizontal: 0, vertical: -1 },
    category: 'system',
  },
];
