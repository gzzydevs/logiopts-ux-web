/**
 * Tests: JSON → Solaar YAML conversion
 */
import { jsonToSolaarYaml } from '../parser';
import type { ProfileConfig, ButtonMapping, Macro } from '../schema';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(buttons: ButtonMapping[]): ProfileConfig {
    return { deviceId: 'test-device', profile: 'default', buttons };
}

function keyPress(...keys: string[]): Macro {
    return { type: 'KeyPress', keys };
}

function mouseClick(button: 'left' | 'middle' | 'right', action: 'click' | number = 'click'): Macro {
    return { type: 'MouseClick', button, action };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('jsonToSolaarYaml', () => {
    it('should produce the %YAML 1.3 header', () => {
        const yaml = jsonToSolaarYaml(makeConfig([]));
        expect(yaml.startsWith('%YAML 1.3\n')).toBe(true);
    });

    it('should produce valid document delimiters --- / ...', () => {
        const config = makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('Control_L', 'c') } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        expect(yaml).toContain('---');
        expect(yaml).toContain('...');
    });

    it('should convert a single button click', () => {
        const config = makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('Control_L', 'c') } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        expect(yaml).toContain('MouseGesture');
        expect(yaml).toContain('Forward Button');
        expect(yaml).toContain('KeyPress');
        expect(yaml).toContain('Control_L');
        expect(yaml).toContain('c');
    });

    it('should convert a button with gesture directions', () => {
        const config = makeConfig([
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
        ]);
        const yaml = jsonToSolaarYaml(config);

        // Should have 5 Rule entries (one per direction) in a single document
        const ruleCount = (yaml.match(/\n- Rule:/g) || []).length;
        expect(ruleCount).toBe(5);

        expect(yaml).toContain('Mouse Up');
        expect(yaml).toContain('Mouse Down');
        expect(yaml).toContain('Mouse Left');
        expect(yaml).toContain('Mouse Right');
    });

    it('should handle a single-key KeyPress as a block list item', () => {
        const config = makeConfig([
            { id: 'DPI Switch', actions: { up: keyPress('XF86_AudioRaiseVolume') } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        // Block format: "  - KeyPress:\n    - XF86_AudioRaiseVolume"
        expect(yaml).toContain('- KeyPress:');
        expect(yaml).toContain('- XF86_AudioRaiseVolume');
    });

    it('should handle multi-key KeyPress as inline array block item', () => {
        const config = makeConfig([
            // Comma-separated string = chord (pressed simultaneously) → [Control_L, c]
            { id: 'Forward Button', actions: { click: keyPress('Control_L,c') } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        // Block format: "  - KeyPress:\n    - [Control_L, c]"
        expect(yaml).toContain('- KeyPress:');
        expect(yaml).toContain('- [Control_L, c]');
    });

    it('should handle MouseClick actions', () => {
        const config = makeConfig([
            { id: 'DPI Switch', actions: { click: mouseClick('middle', 'click') } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        expect(yaml).toContain('MouseClick');
        expect(yaml).toContain('middle');
    });

    it('should handle MouseScroll actions', () => {
        const config = makeConfig([
            { id: 'Thumb Button', actions: { up: { type: 'MouseScroll', horizontal: 0, vertical: 5 } } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        expect(yaml).toContain('MouseScroll');
    });

    it('should handle Execute actions', () => {
        const config = makeConfig([
            {
                id: 'Back Button',
                actions: {
                    click: { type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '+5%'] },
                },
            },
        ]);
        const yaml = jsonToSolaarYaml(config);
        expect(yaml).toContain('Execute');
        expect(yaml).toContain('pactl');
    });

    it('should skip buttons with no actions', () => {
        const config = makeConfig([
            { id: 'Empty Button', actions: {} },
            { id: 'Forward Button', actions: { click: keyPress('a') } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        expect(yaml).not.toContain('Empty Button');
        expect(yaml).toContain('Forward Button');
    });

    it('should skip None-type actions', () => {
        const config = makeConfig([
            {
                id: 'Forward Button',
                actions: {
                    click: { type: 'None' },
                    up: keyPress('XF86_AudioPlay'),
                },
            },
        ]);
        const yaml = jsonToSolaarYaml(config);
        // Only one Rule entry (for up), not two
        const ruleCount = (yaml.match(/\n- Rule:/g) || []).length;
        expect(ruleCount).toBe(1);
        expect(yaml).toContain('Mouse Up');
    });

    it('should handle an empty profile (no buttons)', () => {
        const yaml = jsonToSolaarYaml(makeConfig([]));
        expect(yaml).toContain('%YAML 1.3');
        expect(yaml).toContain('---');
    });

    it('should handle multiple buttons (multi-button config)', () => {
        const config = makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('Control_L', 'c') } },
            { id: 'DPI Switch', actions: { click: mouseClick('middle') } },
            { id: 'Back Button', actions: { click: keyPress('Control_L', 'v') } },
        ]);
        const yaml = jsonToSolaarYaml(config);

        const ruleCount = (yaml.match(/\n- Rule:/g) || []).length;
        expect(ruleCount).toBe(3);

        expect(yaml).toContain('Forward Button');
        expect(yaml).toContain('DPI Switch');
        expect(yaml).toContain('Back Button');
    });

    it('should contain all buttons in a single YAML document', () => {
        const config = makeConfig([
            { id: 'Forward Button', actions: { click: keyPress('a'), up: keyPress('b') } },
            { id: 'Back Button', actions: { click: keyPress('c') } },
        ]);
        const yaml = jsonToSolaarYaml(config);
        // All rules are in one document (one --- marker)
        expect((yaml.match(/\n---\n/g) || []).length).toBe(1);
        expect(yaml).toContain('Forward Button');
        expect(yaml).toContain('Back Button');
    });

    it('should match the format from aplicar_solaar_macros.sh reference', () => {
        const config = makeConfig([
            {
                id: 'Forward Button',
                actions: {
                    click: keyPress('Control_L,c'),
                    up: keyPress('XF86_AudioPlay'),
                    right: keyPress('Super_L,Shift_L,Right'),
                    left: keyPress('Super_L,Shift_L,Left'),
                    down: keyPress('Control_L,b'),
                },
            },
            {
                id: 'DPI Switch',
                actions: {
                    click: mouseClick('middle', 'click'),
                    up: keyPress('XF86_AudioRaiseVolume'),
                    down: keyPress('XF86_AudioLowerVolume'),
                    right: keyPress('Control_L,Tab'),
                    left: keyPress('Control_L,Shift_L,Tab'),
                },
            },
            {
                id: 'Back Button',
                actions: {
                    click: keyPress('Control_L,v'),
                    up: keyPress('Control_L,Shift_L,t'),
                    right: keyPress('Control_L,t'),
                    left: keyPress('Control_L,Shift_L,p'),
                    down: keyPress('Control_L,w'),
                },
            },
        ]);

        const yaml = jsonToSolaarYaml(config);

        // Verify key patterns from the reference script
        expect(yaml).toMatch(/MouseGesture: \[Forward Button, Mouse Up\]/);
        expect(yaml).toContain('MouseGesture: Forward Button');
        expect(yaml).toContain('- [Control_L, c]');
        expect(yaml).toContain('- XF86_AudioPlay');
        expect(yaml).toContain('MouseGesture: DPI Switch');
        expect(yaml).toMatch(/MouseClick: \[middle/);
        expect(yaml).toContain('- XF86_AudioRaiseVolume');
        expect(yaml).toContain('MouseGesture: Back Button');
    });
});
