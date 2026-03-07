/**
 * Translate X11 keysym names and Solaar action types to human-readable labels.
 *
 * Usage:
 *   formatKeysym('Control_L,Shift_L,t') → 'Ctrl+Shift+T'
 *   formatAction({ type: 'KeyPress', keys: ['Control_L,Shift_L,t'] }) → 'Ctrl+Shift+T'
 *   formatAction({ type: 'MouseClick', button: 'middle', count: 1 }) → 'Middle Click'
 */

import type { SolaarAction } from '../types';

// ─── Keysym → human label map ────────────────────────────────────────────────

const KEYSYM_LABELS: Record<string, string> = {
    // Modifiers
    Control_L: 'Ctrl', Control_R: 'Ctrl',
    Shift_L: 'Shift', Shift_R: 'Shift',
    Alt_L: 'Alt', Alt_R: 'Alt',
    Super_L: 'Super', Super_R: 'Super',
    Meta_L: 'Meta', Meta_R: 'Meta',
    ISO_Level3_Shift: 'AltGr',

    // Navigation
    Return: 'Enter', KP_Enter: 'Enter',
    Escape: 'Esc',
    Tab: 'Tab', ISO_Left_Tab: 'Shift+Tab',
    BackSpace: 'Backspace',
    Delete: 'Delete', KP_Delete: 'Delete',
    Insert: 'Insert', KP_Insert: 'Insert',
    Home: 'Home', KP_Home: 'Home',
    End: 'End', KP_End: 'End',
    Page_Up: 'Page Up', KP_Page_Up: 'Page Up',
    Page_Down: 'Page Down', KP_Page_Down: 'Page Down',
    space: 'Space',

    // Arrows
    Up: '↑', Down: '↓', Left: '←', Right: '→',
    KP_Up: '↑', KP_Down: '↓', KP_Left: '←', KP_Right: '→',

    // Media keys (XF86)
    XF86_AudioPlay: '⏯ Play/Pause',
    XF86_AudioPause: '⏸ Pause',
    XF86_AudioStop: '⏹ Stop',
    XF86_AudioNext: '⏭ Next Track',
    XF86_AudioPrev: '⏮ Previous Track',
    XF86_AudioRaiseVolume: '🔊 Volume Up',
    XF86_AudioLowerVolume: '🔉 Volume Down',
    XF86_AudioMute: '🔇 Mute',
    XF86_AudioMicMute: '🎤 Mic Mute',
    XF86_MonBrightnessUp: '🔆 Brightness Up',
    XF86_MonBrightnessDown: '🔅 Brightness Down',
    XF86_Calculator: '🔢 Calculator',
    XF86_Mail: '📧 Mail',
    XF86_Search: '🔍 Search',
    XF86_Explorer: '📁 File Explorer',
    XF86_HomePage: '🏠 Home Page',
    XF86_Favorites: '⭐ Favorites',
    XF86_Launch0: 'Launch 0',
    XF86_Launch1: 'Launch 1',

    // Function keys
    ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`])
    ),
};

/**
 * Format a single keysym to human-readable.
 * Handles both bare keysyms and comma-separated combos.
 */
export function formatKeysym(keysym: string): string {
    // If it's a comma-separated combo like "Control_L,Shift_L,t"
    const parts = keysym.split(',').map(k => k.trim());
    const labels = parts.map(k => {
        // Check our map
        if (KEYSYM_LABELS[k]) return KEYSYM_LABELS[k];
        // Single letter → uppercase
        if (k.length === 1) return k.toUpperCase();
        // XF86_ prefix but not in our map
        if (k.startsWith('XF86_')) return k.replace('XF86_', '').replace(/_/g, ' ');
        // KP_ prefix
        if (k.startsWith('KP_')) return `Numpad ${k.replace('KP_', '')}`;
        // Fallback: titlecase
        return k.replace(/_/g, ' ');
    });

    // Deduplicate consecutive modifiers (e.g., two "Ctrl" if both Control_L and Control_R)
    const deduped: string[] = [];
    for (const label of labels) {
        if (deduped.length === 0 || deduped[deduped.length - 1] !== label) {
            deduped.push(label);
        }
    }

    return deduped.join('+');
}

/**
 * Format a SolaarAction to a concise human-readable string.
 */
export function formatAction(action: SolaarAction): string {
    switch (action.type) {
        case 'None':
            return '—';

        case 'KeyPress': {
            const keys = action.keys ?? [];
            return keys.map(formatKeysym).join(', ');
        }

        case 'MouseClick': {
            const btn = action.button ?? 'left';
            const count = action.count ?? 'click';
            const btnLabel = btn.charAt(0).toUpperCase() + btn.slice(1);
            if (count === 'click' || count === 1) return `${btnLabel} Click`;
            if (count === 2) return `${btnLabel} Double Click`;
            return `${btnLabel} Click ×${count}`;
        }

        case 'MouseScroll': {
            const h = action.horizontal ?? 0;
            const v = action.vertical ?? 0;
            const parts: string[] = [];
            if (h !== 0) parts.push(h > 0 ? `Scroll Right ${h}` : `Scroll Left ${Math.abs(h)}`);
            if (v !== 0) parts.push(v > 0 ? `Scroll Down ${v}` : `Scroll Up ${Math.abs(v)}`);
            return parts.join(', ') || 'Scroll';
        }

        case 'Execute': {
            const cmd = action.command ?? [];
            if (cmd.length === 0) return 'Run script';
            // Show the command basename
            const base = cmd[0].split('/').pop() ?? cmd[0];
            return `▶ ${base}`;
        }

        default:
            return String(action.type);
    }
}
