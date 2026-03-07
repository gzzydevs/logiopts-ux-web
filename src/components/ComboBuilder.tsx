import { useState, useEffect } from 'react';
import { formatKeysym } from '../utils/keyDisplay';
import './ComboBuilder.css';

// ─── Available keys (all X11 keysym format) ──────────────────────────────────

const MODIFIERS = [
    { keysym: 'Control_L', label: 'Ctrl' },
    { keysym: 'Shift_L', label: 'Shift' },
    { keysym: 'Alt_L', label: 'Alt' },
    { keysym: 'Super_L', label: 'Super' },
] as const;

interface KeyOption {
    keysym: string;
    label: string;
}

const KEY_GROUPS: { title: string; keys: KeyOption[] }[] = [
    {
        title: 'Letters',
        keys: 'abcdefghijklmnopqrstuvwxyz'.split('').map(k => ({
            keysym: k,
            label: k.toUpperCase(),
        })),
    },
    {
        title: 'Numbers',
        keys: '0123456789'.split('').map(k => ({ keysym: k, label: k })),
    },
    {
        title: 'F-Keys',
        keys: Array.from({ length: 12 }, (_, i) => ({
            keysym: `F${i + 1}`,
            label: `F${i + 1}`,
        })),
    },
    {
        title: 'Navigation',
        keys: [
            { keysym: 'Return', label: 'Enter' },
            { keysym: 'Escape', label: 'Esc' },
            { keysym: 'Tab', label: 'Tab' },
            { keysym: 'BackSpace', label: '⌫ Back' },
            { keysym: 'Delete', label: 'Del' },
            { keysym: 'Insert', label: 'Ins' },
            { keysym: 'space', label: 'Space' },
            { keysym: 'Up', label: '↑' },
            { keysym: 'Down', label: '↓' },
            { keysym: 'Left', label: '←' },
            { keysym: 'Right', label: '→' },
            { keysym: 'Home', label: 'Home' },
            { keysym: 'End', label: 'End' },
            { keysym: 'Page_Up', label: 'PgUp' },
            { keysym: 'Page_Down', label: 'PgDn' },
        ],
    },
    {
        title: 'Media',
        keys: [
            { keysym: 'XF86_AudioPlay', label: '⏯ Play/Pause' },
            { keysym: 'XF86_AudioStop', label: '⏹ Stop' },
            { keysym: 'XF86_AudioNext', label: '⏭ Next' },
            { keysym: 'XF86_AudioPrev', label: '⏮ Prev' },
            { keysym: 'XF86_AudioRaiseVolume', label: '🔊 Vol+' },
            { keysym: 'XF86_AudioLowerVolume', label: '🔉 Vol-' },
            { keysym: 'XF86_AudioMute', label: '🔇 Mute' },
            { keysym: 'XF86_MonBrightnessUp', label: '🔆 Bright+' },
            { keysym: 'XF86_MonBrightnessDown', label: '🔅 Bright-' },
            { keysym: 'XF86_Calculator', label: '🔢 Calc' },
            { keysym: 'XF86_Mail', label: '📧 Mail' },
            { keysym: 'XF86_Search', label: '🔍 Search' },
        ],
    },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface ComboBuilderProps {
    /** Current keys as X11 keysym comma-separated string (e.g. "Control_L,Shift_L,t") */
    currentKeys: string[];
    onConfirm: (keys: string[]) => void;
    onCancel: () => void;
    open: boolean;
}

export default function ComboBuilder({ currentKeys, onConfirm, onCancel, open }: ComboBuilderProps) {
    // Parse current combo
    const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeGroup, setActiveGroup] = useState(0);

    // Sync from current keys on open
    useEffect(() => {
        if (!open) return;
        const mods = new Set<string>();
        let mainKey: string | null = null;

        for (const k of currentKeys) {
            // Each key string can be comma-separated combo
            const parts = k.split(',');
            for (const p of parts) {
                const trimmed = p.trim();
                if (MODIFIERS.some(m => m.keysym === trimmed)) {
                    mods.add(trimmed);
                } else if (trimmed) {
                    mainKey = trimmed;
                }
            }
        }

        setSelectedMods(mods);
        setSelectedKey(mainKey);
    }, [open, currentKeys]);

    if (!open) return null;

    function toggleMod(keysym: string) {
        setSelectedMods(prev => {
            const next = new Set(prev);
            if (next.has(keysym)) next.delete(keysym);
            else next.add(keysym);
            return next;
        });
    }

    function buildCombo(): string[] {
        const parts: string[] = [];
        // Modifiers in order
        for (const mod of MODIFIERS) {
            if (selectedMods.has(mod.keysym)) parts.push(mod.keysym);
        }
        // Main key
        if (selectedKey) parts.push(selectedKey);
        return parts;
    }

    const combo = buildCombo();
    const preview = combo.length > 0 ? combo.map(formatKeysym).join(' + ') : 'Select a key…';

    function handleConfirm() {
        if (combo.length > 0) {
            onConfirm(combo);
        }
    }

    return (
        <div className="combo-overlay" onClick={onCancel}>
            <div className="combo-builder" onClick={e => e.stopPropagation()}>
                <h3>Build Key Combo</h3>

                {/* Preview */}
                <div className="combo-preview">
                    <span className={combo.length > 0 ? 'combo-active' : 'combo-empty'}>
                        {preview}
                    </span>
                </div>

                {/* Modifiers */}
                <div className="combo-section">
                    <label className="combo-section-label">Modifiers</label>
                    <div className="combo-mods">
                        {MODIFIERS.map(mod => (
                            <button
                                key={mod.keysym}
                                className={`combo-mod-btn ${selectedMods.has(mod.keysym) ? 'active' : ''}`}
                                onClick={() => toggleMod(mod.keysym)}
                            >
                                {mod.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Key group tabs */}
                <div className="combo-section">
                    <label className="combo-section-label">Key</label>
                    <div className="combo-tabs">
                        {KEY_GROUPS.map((group, i) => (
                            <button
                                key={group.title}
                                className={`combo-tab ${activeGroup === i ? 'active' : ''}`}
                                onClick={() => setActiveGroup(i)}
                            >
                                {group.title}
                            </button>
                        ))}
                    </div>

                    {/* Key grid */}
                    <div className="combo-keys">
                        {KEY_GROUPS[activeGroup].keys.map(k => (
                            <button
                                key={k.keysym}
                                className={`combo-key-btn ${selectedKey === k.keysym ? 'active' : ''}`}
                                onClick={() => setSelectedKey(selectedKey === k.keysym ? null : k.keysym)}
                                title={k.keysym}
                            >
                                {k.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="combo-actions">
                    <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={combo.length === 0}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
