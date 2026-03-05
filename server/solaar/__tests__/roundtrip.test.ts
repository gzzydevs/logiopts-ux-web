/**
 * Tests: Roundtrip JSON → YAML → JSON
 *
 * The core property: normalizeConfig(solaarYamlToJson(jsonToSolaarYaml(config)))
 * must equal normalizeConfig(config) for any valid config.
 */
import { jsonToSolaarYaml, solaarYamlToJson, normalizeConfig } from '../parser';
import { validateProfileConfig, validateSolaarYaml } from '../validator';
import type { ProfileConfig, ButtonMapping, Macro } from '../schema';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function keyPress(...keys: string[]): Macro {
    return { type: 'KeyPress', keys };
}

function mouseClick(button: 'left' | 'middle' | 'right', action: 'click' | number = 'click'): Macro {
    return { type: 'MouseClick', button, action };
}

function makeConfig(buttons: ButtonMapping[]): ProfileConfig {
    return { deviceId: 'test-device', profile: 'default', buttons };
}

/** Roundtrip: JSON → YAML → JSON, compare normalized */
function roundtrip(config: ProfileConfig): void {
    const yaml = jsonToSolaarYaml(config);
    const parsed = solaarYamlToJson(yaml, config.deviceId, config.profile);
    const normalizedOriginal = normalizeConfig(config);
    const normalizedParsed = normalizeConfig(parsed);
    expect(normalizedParsed).toEqual(normalizedOriginal);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Roundtrip: JSON → YAML → JSON', () => {
    it('should roundtrip a simple single-button config', () => {
        roundtrip(makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('Control_L', 'c') } },
        ]));
    });

    it('should roundtrip a button with all gesture directions', () => {
        roundtrip(makeConfig([
            {
                id: 'Forward Button',
                actions: {
                    click: keyPress('Control_L', 'c'),
                    up: keyPress('XF86_AudioPlay'),
                    down: keyPress('Control_L', 'b'),
                    left: keyPress('Super_L', 'Shift_L', 'Left'),
                    right: keyPress('Super_L', 'Shift_L', 'Right'),
                },
            },
        ]));
    });

    it('should roundtrip multiple buttons', () => {
        roundtrip(makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('Control_L', 'c') } },
            { id: 'DPI Switch', actions: { click: mouseClick('middle') } },
            { id: 'Back Button', actions: { click: keyPress('Control_L', 'v') } },
        ]));
    });

    it('should roundtrip the full reference config', () => {
        roundtrip(makeConfig([
            {
                id: 'Forward Button',
                actions: {
                    click: keyPress('Control_L', 'c'),
                    up: keyPress('XF86_AudioPlay'),
                    right: keyPress('Super_L', 'Shift_L', 'Right'),
                    left: keyPress('Super_L', 'Shift_L', 'Left'),
                    down: keyPress('Control_L', 'b'),
                },
            },
            {
                id: 'DPI Switch',
                actions: {
                    click: mouseClick('middle', 'click'),
                    up: keyPress('XF86_AudioRaiseVolume'),
                    down: keyPress('XF86_AudioLowerVolume'),
                    right: keyPress('Control_L', 'Tab'),
                    left: keyPress('Control_L', 'Shift_L', 'Tab'),
                },
            },
            {
                id: 'Back Button',
                actions: {
                    click: keyPress('Control_L', 'v'),
                    up: keyPress('Control_L', 'Shift_L', 't'),
                    right: keyPress('Control_L', 't'),
                    left: keyPress('Control_L', 'Shift_L', 'p'),
                    down: keyPress('Control_L', 'w'),
                },
            },
        ]));
    });

    it('should roundtrip a button with MouseScroll', () => {
        roundtrip(makeConfig([
            {
                id: 'Thumb Button',
                actions: {
                    up: { type: 'MouseScroll', horizontal: 0, vertical: 5 },
                    down: { type: 'MouseScroll', horizontal: 0, vertical: -5 },
                },
            },
        ]));
    });

    it('should roundtrip a button with Execute', () => {
        roundtrip(makeConfig([
            {
                id: 'Back Button',
                actions: {
                    click: { type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '+5%'] },
                },
            },
        ]));
    });

    it('should normalize away None actions during roundtrip', () => {
        const config = makeConfig([
            {
                id: 'Forward Button',
                actions: {
                    click: keyPress('Control_L', 'c'),
                    up: { type: 'None' },  // This should be dropped
                    down: keyPress('Control_L', 'b'),
                },
            },
        ]);

        const expected = makeConfig([
            {
                id: 'Forward Button',
                actions: {
                    click: keyPress('Control_L', 'c'),
                    down: keyPress('Control_L', 'b'),
                },
            },
        ]);

        const yaml = jsonToSolaarYaml(config);
        const parsed = solaarYamlToJson(yaml, 'test-device', 'default');
        expect(normalizeConfig(parsed)).toEqual(normalizeConfig(expected));
    });

    it('should handle buttons with no actions (empty after normalization)', () => {
        const config = makeConfig([
            { id: 'Empty Button', actions: {} },
            { id: 'Forward Button', actions: { click: keyPress('a') } },
        ]);

        const yaml = jsonToSolaarYaml(config);
        const parsed = solaarYamlToJson(yaml, 'test-device', 'default');
        const normalized = normalizeConfig(parsed);

        // Empty button should be removed during normalization
        expect(normalized.buttons).toHaveLength(1);
        expect(normalized.buttons[0].id).toBe('Forward Button');
    });

    it('should produce deterministic order regardless of input order', () => {
        const config1 = makeConfig([
            { id: 'Back Button', actions: { click: keyPress('a') } },
            { id: 'Forward Button', actions: { click: keyPress('b') } },
        ]);

        const config2 = makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('b') } },
            { id: 'Back Button', actions: { click: keyPress('a') } },
        ]);

        // Both should produce the same normalized result
        expect(normalizeConfig(config1)).toEqual(normalizeConfig(config2));
    });
});

// ─── Validation integration ─────────────────────────────────────────────────

describe('Validation integration', () => {
    it('should validate a valid config', () => {
        const config = makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('Control_L', 'c') } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(true);
    });

    it('should reject invalid keysyms', () => {
        const config = makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('INVALID_KEY_THAT_DOESNT_EXIST') } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_KEYSYM');
    });

    it('should reject empty KeyPress', () => {
        const config = makeConfig([
            { id: 'Forward Button', actions: { click: { type: 'KeyPress', keys: [] } } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('EMPTY_KEYS');
    });

    it('should validate generated YAML', () => {
        const config = makeConfig([
            {
                id: 'Forward Button',
                actions: {
                    click: keyPress('Control_L', 'c'),
                    up: keyPress('XF86_AudioPlay'),
                },
            },
        ]);
        const yaml = jsonToSolaarYaml(config);
        const result = validateSolaarYaml(yaml);
        expect(result.valid).toBe(true);
    });

    it('should reject config with missing deviceId', () => {
        const config: ProfileConfig = { deviceId: '', profile: 'default', buttons: [] };
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('MISSING_DEVICE_ID');
    });

    it('should reject config with missing profile', () => {
        const config: ProfileConfig = { deviceId: 'dev', profile: '', buttons: [] };
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('MISSING_PROFILE');
    });

    it('should reject invalid macro type', () => {
        const config = makeConfig([
            { id: 'Btn', actions: { click: { type: 'UnknownType' } as any } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_MACRO_TYPE');
    });

    it('should reject invalid mouse button', () => {
        const config = makeConfig([
            { id: 'Btn', actions: { click: { type: 'MouseClick', button: 'invalid' as any, action: 'click' } } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_MOUSE_BUTTON');
    });

    it('should reject empty Execute command', () => {
        const config = makeConfig([
            { id: 'Btn', actions: { click: { type: 'Execute', command: [] } } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('EMPTY_COMMAND');
    });

    it('should accept a valid None macro', () => {
        const config = makeConfig([
            { id: 'Btn', actions: { click: { type: 'None' } } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(true);
    });

    it('should accept a valid MouseScroll macro', () => {
        const config = makeConfig([
            { id: 'Btn', actions: { click: { type: 'MouseScroll', horizontal: 0, vertical: 5 } } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(true);
    });

    it('should reject a null macro', () => {
        const config = makeConfig([
            { id: 'Btn', actions: { click: null as any } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_MACRO_TYPE');
    });

    it('should reject a button with missing id', () => {
        const config = makeConfig([
            { id: '', actions: { click: keyPress('a') } },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_BUTTON_NAME');
    });

    it('should reject a button with invalid direction key', () => {
        const config = makeConfig([
            { id: 'Btn', actions: { diagonal: keyPress('a') } as any },
        ]);
        const result = validateProfileConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_DIRECTION');
    });
});

// ─── isValidKeysym coverage ─────────────────────────────────────────────────

describe('isValidKeysym', () => {
    // Import directly for targeted testing
    const { isValidKeysym } = require('../schema');

    it('should return false for empty string', () => {
        expect(isValidKeysym('')).toBe(false);
    });

    it('should return true for modifier keys', () => {
        expect(isValidKeysym('Control_L')).toBe(true);
        expect(isValidKeysym('Super_R')).toBe(true);
    });

    it('should return true for special keys', () => {
        expect(isValidKeysym('Tab')).toBe(true);
        expect(isValidKeysym('Return')).toBe(true);
        expect(isValidKeysym('F12')).toBe(true);
    });

    it('should return true for single printable characters', () => {
        expect(isValidKeysym('a')).toBe(true);
        expect(isValidKeysym('Z')).toBe(true);
        expect(isValidKeysym('5')).toBe(true);
    });

    it('should return true for XF86_ prefixed keys (extensible)', () => {
        expect(isValidKeysym('XF86_AudioPlay')).toBe(true);
        expect(isValidKeysym('XF86_SomeNewKey')).toBe(true);
    });

    it('should return false for unknown multi-char keys', () => {
        expect(isValidKeysym('TotallyFakeKey')).toBe(false);
        expect(isValidKeysym('INVALID_KEY_THAT_DOESNT_EXIST')).toBe(false);
    });
});
