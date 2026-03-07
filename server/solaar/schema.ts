/**
 * Schema definitions for the Solaar parser module.
 *
 * These types model the JSON ⇄ YAML transformation independently from
 * the rest of the application so the parser can be tested in isolation.
 */

// ─── Macro (what a button/gesture does) ──────────────────────────────────────

export type Macro =
    | { type: 'KeyPress'; keys: string[] }
    | { type: 'MouseClick'; button: 'left' | 'middle' | 'right'; action: 'click' | number }
    | { type: 'MouseScroll'; horizontal: number; vertical: number }
    | { type: 'Execute'; command: string[] }
    | { type: 'None' };

// ─── Gesture directions ──────────────────────────────────────────────────────

export type GestureDirection = 'click' | 'up' | 'down' | 'left' | 'right';

export const ALL_DIRECTIONS: GestureDirection[] = ['click', 'up', 'down', 'left', 'right'];

// ─── Button mapping ──────────────────────────────────────────────────────────

/** A single button with its actions keyed by gesture direction */
export interface ButtonMapping {
    /** Solaar button name, e.g. "Forward Button", "DPI Switch", "Back Button" */
    id: string;
    /** Actions per direction. Missing directions default to { type: 'None' } */
    actions: Partial<Record<GestureDirection, Macro>>;
}

// ─── Profile config (parser input/output) ────────────────────────────────────

export interface ProfileConfig {
    deviceId: string;
    profile: string;
    buttons: ButtonMapping[];
}

// ─── Internal representation of one Solaar YAML document ─────────────────────

export interface SolaarRuleDoc {
    buttonName: string;
    direction: GestureDirection;
    action: Macro;
    comment?: string;
}

// ─── Direction maps ──────────────────────────────────────────────────────────

/** Map our direction → Solaar YAML direction string (null = click, no suffix) */
export const SOLAAR_DIRECTION_MAP: Record<GestureDirection, string | null> = {
    click: null,
    up: 'Mouse Up',
    down: 'Mouse Down',
    left: 'Mouse Left',
    right: 'Mouse Right',
};

/** Reverse: Solaar direction string → our direction */
export const REVERSE_DIRECTION_MAP: Record<string, GestureDirection> = {
    'Mouse Up': 'up',
    'Mouse Down': 'down',
    'Mouse Left': 'left',
    'Mouse Right': 'right',
};

// ─── Known valid X11 keysyms ─────────────────────────────────────────────────

export const VALID_MODIFIER_KEYS = new Set([
    'Control_L', 'Control_R',
    'Shift_L', 'Shift_R',
    'Alt_L', 'Alt_R',
    'Super_L', 'Super_R',
    'Meta_L', 'Meta_R',
]);

export const VALID_SPECIAL_KEYS = new Set([
    // Media
    'XF86_AudioPlay', 'XF86_AudioPause', 'XF86_AudioStop',
    'XF86_AudioRaiseVolume', 'XF86_AudioLowerVolume', 'XF86_AudioMute',
    'XF86_AudioNext', 'XF86_AudioPrev',
    // Navigation
    'Tab', 'Return', 'Escape', 'space', 'BackSpace', 'Delete',
    'Home', 'End', 'Page_Up', 'Page_Down',
    // Arrows
    'Up', 'Down', 'Left', 'Right',
    // Function keys
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

/**
 * Returns true if `key` looks like a valid X11 keysym.
 * Accepts:
 *   - Single keysyms (modifiers, special keys, printable chars, XF86_ family)
 *   - Comma-separated chords: "Control_L,c" or "Control_L,Shift_L,t"
 */
export function isValidKeysym(key: string): boolean {
    if (!key || key.length === 0) return false;
    // Comma-separated chord — validate each part individually
    if (key.includes(',')) {
        return key.split(',').every(p => isValidKeysym(p.trim()));
    }
    if (VALID_MODIFIER_KEYS.has(key)) return true;
    if (VALID_SPECIAL_KEYS.has(key)) return true;
    // Single printable character (a-z, A-Z, 0-9, punctuation)
    if (/^[a-zA-Z0-9]$/.test(key)) return true;
    // XF86 family (extensible)
    if (/^XF86_/.test(key)) return true;
    return false;
}
