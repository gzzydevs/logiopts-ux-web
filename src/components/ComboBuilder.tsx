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
    {
        title: 'Punctuation',
        keys: [
            { keysym: 'semicolon', label: ';' },
            { keysym: 'colon', label: ':' },
            { keysym: 'comma', label: ',' },
            { keysym: 'period', label: '.' },
            { keysym: 'slash', label: '/' },
            { keysym: 'backslash', label: '\\' },
            { keysym: 'bracketleft', label: '[' },
            { keysym: 'bracketright', label: ']' },
            { keysym: 'braceleft', label: '{' },
            { keysym: 'braceright', label: '}' },
            { keysym: 'parenleft', label: '(' },
            { keysym: 'parenright', label: ')' },
            { keysym: 'apostrophe', label: "'" },
            { keysym: 'quotedbl', label: '"' },
            { keysym: 'grave', label: '`' },
            { keysym: 'minus', label: '-' },
            { keysym: 'equal', label: '=' },
            { keysym: 'plus', label: '+' },
            { keysym: 'underscore', label: '_' },
            { keysym: 'at', label: '@' },
            { keysym: 'numbersign', label: '#' },
            { keysym: 'exclam', label: '!' },
            { keysym: 'question', label: '?' },
            { keysym: 'ampersand', label: '&' },
            { keysym: 'bar', label: '|' },
            { keysym: 'asciitilde', label: '~' },
            { keysym: 'asciicircum', label: '^' },
        ],
    },
    {
        title: 'Numpad',
        keys: [
            ...Array.from({ length: 10 }, (_, i) => ({
                keysym: `KP_${i}`,
                label: `KP ${i}`,
            })),
            { keysym: 'KP_Enter', label: 'KP Enter' },
            { keysym: 'KP_Add', label: 'KP +' },
            { keysym: 'KP_Subtract', label: 'KP -' },
            { keysym: 'KP_Multiply', label: 'KP *' },
            { keysym: 'KP_Divide', label: 'KP /' },
            { keysym: 'KP_Decimal', label: 'KP .' },
        ],
    },
];

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: { label: string; keys: string[] }[] = [
    { label: 'Copy', keys: ['Control_L', 'c'] },
    { label: 'Paste', keys: ['Control_L', 'v'] },
    { label: 'Cut', keys: ['Control_L', 'x'] },
    { label: 'Undo', keys: ['Control_L', 'z'] },
    { label: 'Redo', keys: ['Control_L', 'Shift_L', 'z'] },
    { label: 'Select All', keys: ['Control_L', 'a'] },
    { label: 'New Tab', keys: ['Control_L', 't'] },
    { label: 'Close Tab', keys: ['Control_L', 'w'] },
    { label: 'Restore Tab', keys: ['Control_L', 'Shift_L', 't'] },
    { label: 'Play/Pause', keys: ['XF86_AudioPlay'] },
    { label: 'Vol+', keys: ['XF86_AudioRaiseVolume'] },
    { label: 'Vol-', keys: ['XF86_AudioLowerVolume'] },
    { label: 'Mute', keys: ['XF86_AudioMute'] },
];

// Virtual tab index for presets
const PRESETS_TAB = -1;

// ─── Component ───────────────────────────────────────────────────────────────

interface ComboBuilderProps {
    /** Current keys as X11 keysym comma-separated string (e.g. "Control_L,Shift_L,t") */
    currentKeys: string[];
    onConfirm: (keys: string[]) => void;
    onCancel: () => void;
    open: boolean;
}

export default function ComboBuilder({ currentKeys, onConfirm, onCancel, open }: ComboBuilderProps) {
    // CB-01: use array to preserve selection order
    const [selectedMods, setSelectedMods] = useState<string[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeGroup, setActiveGroup] = useState(0);
    // CB-06: search filter
    const [searchQuery, setSearchQuery] = useState('');

    // Sync from current keys on open
    useEffect(() => {
        if (!open) return;
        // CB-01: preserve order from input array
        const mods: string[] = [];
        let mainKey: string | null = null;

        for (const k of currentKeys) {
            const parts = k.split(',');
            for (const p of parts) {
                const trimmed = p.trim();
                if (MODIFIERS.some(m => m.keysym === trimmed)) {
                    if (!mods.includes(trimmed)) mods.push(trimmed);
                } else if (trimmed) {
                    mainKey = trimmed;
                }
            }
        }

        setSelectedMods(mods);
        setSelectedKey(mainKey);
        setSearchQuery('');
    }, [open, currentKeys]);

    // CB-03: Enter to confirm, Escape to cancel
    useEffect(() => {
        if (!open) return;
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') { onCancel(); }
            if (e.key === 'Enter') {
                const parts = [...selectedMods];
                if (selectedKey) parts.push(selectedKey);
                if (parts.length > 0) { onConfirm(parts); }
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, selectedMods, selectedKey, onCancel, onConfirm]);

    if (!open) return null;

    // CB-01: array-based toggle preserves click order
    function toggleMod(keysym: string) {
        setSelectedMods(prev => {
            if (prev.includes(keysym)) return prev.filter(k => k !== keysym);
            return [...prev, keysym];
        });
    }

    // CB-01: build combo from ordered array
    function buildCombo(): string[] {
        const parts = [...selectedMods];
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

    // CB-06: filtered groups (or single group when no search)
    const filteredGroups = searchQuery.trim()
        ? KEY_GROUPS.map(g => ({
            ...g,
            keys: g.keys.filter(k =>
                k.keysym.toLowerCase().includes(searchQuery.toLowerCase()) ||
                k.label.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        })).filter(g => g.keys.length > 0)
        : activeGroup === PRESETS_TAB ? [] : [KEY_GROUPS[activeGroup]];

    const showPresets = !searchQuery.trim() && activeGroup === PRESETS_TAB;

    return (
        <div className="combo-overlay" onClick={onCancel}>
            <div className="combo-builder" onClick={e => e.stopPropagation()}>
                <h3>Build Key Combo</h3>

                {/* Preview + CB-02: Clear button */}
                <div className="combo-preview">
                    <span className={combo.length > 0 ? 'combo-active' : 'combo-empty'}>
                        {preview}
                    </span>
                    {combo.length > 0 && (
                        <button className="combo-clear-btn" onClick={() => {
                            setSelectedMods([]);
                            setSelectedKey(null);
                        }} title="Clear">
                            ✕
                        </button>
                    )}
                </div>

                {/* Modifiers */}
                <div className="combo-section">
                    <label className="combo-section-label">Modifiers</label>
                    <div className="combo-mods">
                        {MODIFIERS.map(mod => (
                            <button
                                key={mod.keysym}
                                className={`combo-mod-btn ${selectedMods.includes(mod.keysym) ? 'active' : ''}`}
                                onClick={() => toggleMod(mod.keysym)}
                            >
                                {mod.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CB-06: Search input */}
                <input
                    type="text"
                    className="combo-search"
                    placeholder="Search keys…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />

                {/* Key group tabs */}
                <div className="combo-section">
                    <label className="combo-section-label">Key</label>
                    {!searchQuery.trim() && (
                        <div className="combo-tabs">
                            {/* CB-07: Presets tab */}
                            <button
                                className={`combo-tab ${activeGroup === PRESETS_TAB ? 'active' : ''}`}
                                onClick={() => setActiveGroup(PRESETS_TAB)}
                            >
                                Presets
                            </button>
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
                    )}

                    {/* CB-07: Presets grid */}
                    {showPresets && (
                        <div className="combo-keys combo-presets">
                            {PRESETS.map(preset => (
                                <button
                                    key={preset.label}
                                    className="combo-key-btn combo-preset-btn"
                                    onClick={() => {
                                        onConfirm(preset.keys);
                                    }}
                                    title={preset.keys.map(formatKeysym).join(' + ')}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Key grid (normal or search results) */}
                    {!showPresets && filteredGroups.map(group => (
                        <div key={group.title}>
                            {searchQuery.trim() && (
                                <div className="combo-search-group-label">{group.title}</div>
                            )}
                            <div className="combo-keys">
                                {group.keys.map(k => (
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
                    ))}
                    {!showPresets && filteredGroups.length === 0 && searchQuery.trim() && (
                        <p className="combo-no-results">No keys match "{searchQuery}"</p>
                    )}
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
