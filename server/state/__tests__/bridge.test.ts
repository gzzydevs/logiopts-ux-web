/**
 * Tests for the bridge module (UI types ↔ Parser types conversion).
 *
 * These tests are pure logic — no DB or I/O needed.
 */

// Mock db/index to avoid loading better-sqlite3 (it uses import.meta.url)
jest.mock('../../db/index', () => ({ default: {}, SCRIPTS_DIR: '/tmp/test-scripts', DATA_DIR: '/tmp/test-data', DB_PATH: ':memory:' }));
jest.mock('../../db/paths', () => ({ SCRIPTS_DIR: '/tmp/test-scripts', DATA_DIR: '/tmp/test-data', DB_PATH: ':memory:' }));
jest.mock('../../db/repositories/script.repo', () => ({ getScriptById: jest.fn() }));

import { buttonConfigsToProfileConfig, profileConfigToButtonConfigs } from '../bridge';
import type { ButtonConfig, SolaarAction, GestureDirection as UIDirection } from '../../types';
import type { ProfileConfig, ButtonMapping, Macro } from '../../solaar/schema';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGestures(overrides: Partial<Record<UIDirection, SolaarAction>> = {}): Record<UIDirection, SolaarAction> {
    return {
        None: { type: 'None' },
        Up: { type: 'None' },
        Down: { type: 'None' },
        Left: { type: 'None' },
        Right: { type: 'None' },
        ...overrides,
    };
}

function makeButtonConfig(cid: number, opts: {
    gestureMode?: boolean;
    gestures?: Partial<Record<UIDirection, SolaarAction>>;
    simpleAction?: SolaarAction;
} = {}): ButtonConfig {
    return {
        cid,
        gestureMode: opts.gestureMode ?? false,
        gestures: makeGestures(opts.gestures),
        simpleAction: opts.simpleAction ?? { type: 'None' },
    };
}

// ─── buttonConfigsToProfileConfig ────────────────────────────────────────────

describe('buttonConfigsToProfileConfig', () => {
    it('should convert a simple action to a click mapping', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(86, {
                simpleAction: { type: 'KeyPress', keys: ['Control_L', 'c'] },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev-123', 'default');

        expect(result.deviceId).toBe('dev-123');
        expect(result.profile).toBe('default');
        expect(result.buttons).toHaveLength(1);
        expect(result.buttons[0].id).toBe('Forward Button'); // CID 86 → resolved to Solaar name
        expect(result.buttons[0].actions.click).toEqual({
            type: 'KeyPress',
            keys: ['Control_L', 'c'],
        });
    });

    it('should convert gesture mode buttons', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(86, {
                gestureMode: true,
                gestures: {
                    None: { type: 'KeyPress', keys: ['Control_L', 'c'] },
                    Up: { type: 'KeyPress', keys: ['XF86_AudioPlay'] },
                    Down: { type: 'KeyPress', keys: ['Control_L', 'b'] },
                },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev-123', 'default');

        expect(result.buttons).toHaveLength(1);
        const btn = result.buttons[0];
        expect(btn.actions.click).toEqual({ type: 'KeyPress', keys: ['Control_L', 'c'] });
        expect(btn.actions.up).toEqual({ type: 'KeyPress', keys: ['XF86_AudioPlay'] });
        expect(btn.actions.down).toEqual({ type: 'KeyPress', keys: ['Control_L', 'b'] });
        expect(btn.actions.left).toBeUndefined();
        expect(btn.actions.right).toBeUndefined();
    });

    it('should skip buttons with no actions', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(86), // all None
            makeButtonConfig(253, {
                simpleAction: { type: 'MouseClick', button: 'middle', count: 'click' },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev', 'default');

        expect(result.buttons).toHaveLength(1);
        expect(result.buttons[0].id).toBe('DPI Switch'); // CID 253 → resolved to Solaar name
    });

    it('should convert MouseClick actions correctly', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(253, {
                simpleAction: { type: 'MouseClick', button: 'middle', count: 'click' },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev', 'default');

        expect(result.buttons[0].actions.click).toEqual({
            type: 'MouseClick',
            button: 'middle',
            action: 'click',
        });
    });

    it('should convert MouseScroll actions correctly', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(86, {
                gestureMode: true,
                gestures: {
                    Up: { type: 'MouseScroll', horizontal: 0, vertical: 5 },
                    Down: { type: 'MouseScroll', horizontal: 0, vertical: -5 },
                },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev', 'default');

        expect(result.buttons[0].actions.up).toEqual({
            type: 'MouseScroll',
            horizontal: 0,
            vertical: 5,
        });
    });

    it('should convert Execute actions correctly', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(86, {
                simpleAction: { type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '+5%'] },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev', 'default');

        expect(result.buttons[0].actions.click).toEqual({
            type: 'Execute',
            command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '+5%'],
        });
    });

    it('should convert RunScript to None when script is not found', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(86, {
                simpleAction: { type: 'RunScript', scriptId: 'nonexistent-uuid' },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev', 'default');

        // RunScript resolves the script path via DB; when not found it emits None
        // (button is skipped since all actions are None)
        expect(result.buttons).toHaveLength(0);
    });

    it('should handle multiple buttons', () => {
        const buttons: ButtonConfig[] = [
            makeButtonConfig(86, {
                gestureMode: true,
                gestures: {
                    None: { type: 'KeyPress', keys: ['Control_L', 'c'] },
                    Up: { type: 'KeyPress', keys: ['XF86_AudioPlay'] },
                },
            }),
            makeButtonConfig(253, {
                simpleAction: { type: 'MouseClick', button: 'middle', count: 'click' },
            }),
        ];

        const result = buttonConfigsToProfileConfig(buttons, 'dev', 'default');

        expect(result.buttons).toHaveLength(2);
    });

    it('should handle empty buttons array', () => {
        const result = buttonConfigsToProfileConfig([], 'dev', 'default');

        expect(result.deviceId).toBe('dev');
        expect(result.profile).toBe('default');
        expect(result.buttons).toHaveLength(0);
    });
});

// ─── profileConfigToButtonConfigs ────────────────────────────────────────────

describe('profileConfigToButtonConfigs', () => {
    it('should convert a single click mapping to simple mode', () => {
        const config: ProfileConfig = {
            deviceId: 'dev',
            profile: 'default',
            buttons: [{
                id: 'CID-86',
                actions: {
                    click: { type: 'KeyPress', keys: ['Control_L', 'c'] },
                },
            }],
        };

        const result = profileConfigToButtonConfigs(config);

        expect(result).toHaveLength(1);
        expect(result[0].cid).toBe(86);
        expect(result[0].gestureMode).toBe(false);
        expect(result[0].simpleAction).toEqual({ type: 'KeyPress', keys: ['Control_L', 'c'] });
    });

    it('should convert multi-direction mappings to gesture mode', () => {
        const config: ProfileConfig = {
            deviceId: 'dev',
            profile: 'default',
            buttons: [{
                id: 'CID-86',
                actions: {
                    click: { type: 'KeyPress', keys: ['Control_L', 'c'] },
                    up: { type: 'KeyPress', keys: ['XF86_AudioPlay'] },
                    down: { type: 'KeyPress', keys: ['Control_L', 'b'] },
                },
            }],
        };

        const result = profileConfigToButtonConfigs(config);

        expect(result[0].gestureMode).toBe(true);
        expect(result[0].gestures.None).toEqual({ type: 'KeyPress', keys: ['Control_L', 'c'] });
        expect(result[0].gestures.Up).toEqual({ type: 'KeyPress', keys: ['XF86_AudioPlay'] });
        expect(result[0].gestures.Down).toEqual({ type: 'KeyPress', keys: ['Control_L', 'b'] });
    });

    it('should handle empty config', () => {
        const result = profileConfigToButtonConfigs({
            deviceId: 'dev',
            profile: 'default',
            buttons: [],
        });

        expect(result).toHaveLength(0);
    });

    it('should extract CID from button id format', () => {
        const config: ProfileConfig = {
            deviceId: 'dev',
            profile: 'default',
            buttons: [{
                id: 'CID-253',
                actions: { click: { type: 'MouseClick', button: 'middle', action: 'click' } },
            }],
        };

        const result = profileConfigToButtonConfigs(config);

        expect(result[0].cid).toBe(253);
    });

    it('should resolve known Solaar button name IDs to their CID', () => {
        const config: ProfileConfig = {
            deviceId: 'dev',
            profile: 'default',
            buttons: [{
                id: 'Forward Button',
                actions: { click: { type: 'KeyPress', keys: ['a'] } },
            }],
        };

        const result = profileConfigToButtonConfigs(config);

        expect(result[0].cid).toBe(86); // Forward Button = CID 86
    });
});

// ─── Roundtrip: UI → Parser → UI ────────────────────────────────────────────

describe('Bridge roundtrip', () => {
    it('should preserve simple action through conversion', () => {
        const original: ButtonConfig[] = [
            makeButtonConfig(86, {
                simpleAction: { type: 'KeyPress', keys: ['Control_L', 'c'] },
            }),
        ];

        const parserConfig = buttonConfigsToProfileConfig(original, 'dev', 'default');
        const roundtripped = profileConfigToButtonConfigs(parserConfig);

        expect(roundtripped).toHaveLength(1);
        expect(roundtripped[0].simpleAction).toEqual({ type: 'KeyPress', keys: ['Control_L', 'c'] });
    });

    it('should preserve gesture actions through conversion', () => {
        const original: ButtonConfig[] = [
            makeButtonConfig(86, {
                gestureMode: true,
                gestures: {
                    None: { type: 'KeyPress', keys: ['Control_L', 'c'] },
                    Up: { type: 'KeyPress', keys: ['XF86_AudioPlay'] },
                    Down: { type: 'MouseScroll', horizontal: 0, vertical: -5 },
                    Left: { type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '-5%'] },
                    Right: { type: 'MouseClick', button: 'middle', count: 'click' },
                },
            }),
        ];

        const parserConfig = buttonConfigsToProfileConfig(original, 'dev', 'default');
        const roundtripped = profileConfigToButtonConfigs(parserConfig);

        expect(roundtripped).toHaveLength(1);
        expect(roundtripped[0].gestureMode).toBe(true);
        expect(roundtripped[0].gestures.None).toEqual({ type: 'KeyPress', keys: ['Control_L', 'c'] });
        expect(roundtripped[0].gestures.Up).toEqual({ type: 'KeyPress', keys: ['XF86_AudioPlay'] });
        expect(roundtripped[0].gestures.Down).toEqual({ type: 'MouseScroll', horizontal: 0, vertical: -5 });
        expect(roundtripped[0].gestures.Left).toEqual({ type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '-5%'] });
        // MouseClick roundtrip: count → action → count
        expect(roundtripped[0].gestures.Right).toEqual({ type: 'MouseClick', button: 'middle', count: 'click' });
    });
});
