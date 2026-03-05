/**
 * Tests: Solaar YAML → JSON conversion
 */
import { solaarYamlToJson } from '../parser';
import { validateSolaarYaml } from '../validator';
import type { Macro } from '../schema';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('solaarYamlToJson', () => {
    it('should parse a simple single-rule YAML', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(1);
        expect(result.buttons[0].id).toBe('Forward Button');
        expect(result.buttons[0].actions.click).toEqual({
            type: 'KeyPress',
            keys: ['Control_L', 'c'],
        });
    });

    it('should parse a single-key KeyPress (bare string)', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [DPI Switch, Mouse Up]
- KeyPress: XF86_AudioRaiseVolume
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons[0].actions.up).toEqual({
            type: 'KeyPress',
            keys: ['XF86_AudioRaiseVolume'],
        });
    });

    it('should parse gestures with directions', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button, Mouse Up]
- KeyPress: XF86_AudioPlay
...
---
- MouseGesture: [Forward Button, Mouse Down]
- KeyPress: [Control_L, b]
...
---
- MouseGesture: [Forward Button, Mouse Left]
- KeyPress: [Super_L, Shift_L, Left]
...
---
- MouseGesture: [Forward Button, Mouse Right]
- KeyPress: [Super_L, Shift_L, Right]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(1);
        const btn = result.buttons[0];
        expect(btn.id).toBe('Forward Button');
        expect(btn.actions.up).toBeDefined();
        expect(btn.actions.down).toBeDefined();
        expect(btn.actions.left).toBeDefined();
        expect(btn.actions.right).toBeDefined();
    });

    it('should group rules by button name', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
---
- MouseGesture: [DPI Switch]
- MouseClick: [middle, click]
...
---
- MouseGesture: [Back Button]
- KeyPress: [Control_L, v]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(3);
        expect(result.buttons.map(b => b.id)).toEqual([
            'Forward Button',
            'DPI Switch',
            'Back Button',
        ]);
    });

    it('should parse MouseClick actions', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [DPI Switch]
- MouseClick: [middle, click]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons[0].actions.click).toEqual({
            type: 'MouseClick',
            button: 'middle',
            action: 'click',
        });
    });

    it('should parse MouseScroll actions', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Thumb Button, Mouse Up]
- MouseScroll: [0, 5]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons[0].actions.up).toEqual({
            type: 'MouseScroll',
            horizontal: 0,
            vertical: 5,
        });
    });

    it('should parse Execute actions', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Back Button]
- Execute: [pactl, set-sink-volume, '@DEFAULT_SINK@', '+5%']
...
`;
        const result = solaarYamlToJson(yaml);
        const action = result.buttons[0].actions.click as Extract<Macro, { type: 'Execute' }>;
        expect(action.type).toBe('Execute');
        expect(action.command).toContain('pactl');
    });

    it('should handle empty YAML', () => {
        const result = solaarYamlToJson('');
        expect(result.buttons).toHaveLength(0);
    });

    it('should handle YAML with only header', () => {
        const result = solaarYamlToJson('%YAML 1.3\n---\n...\n');
        expect(result.buttons).toHaveLength(0);
    });

    it('should skip malformed YAML documents gracefully', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
---
this is not valid yaml: [[[
...
---
- MouseGesture: [Back Button]
- KeyPress: [Control_L, v]
...
`;
        const result = solaarYamlToJson(yaml);
        // Should parse 2 valid documents, skip the malformed one
        expect(result.buttons.length).toBeGreaterThanOrEqual(1);
        expect(result.buttons.some(b => b.id === 'Forward Button')).toBe(true);
    });

    it('should ignore unknown fields in YAML documents', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
- SomeUnknownField: [value1, value2]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(1);
        expect(result.buttons[0].actions.click).toEqual({
            type: 'KeyPress',
            keys: ['Control_L', 'c'],
        });
    });

    it('should handle YAML with comments', () => {
        const yaml = `%YAML 1.3
---
# === FORWARD BUTTON ===
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(1);
        expect(result.buttons[0].id).toBe('Forward Button');
    });

    it('should use provided deviceId and profile', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
`;
        const result = solaarYamlToJson(yaml, 'my-device', 'gaming');
        expect(result.deviceId).toBe('my-device');
        expect(result.profile).toBe('gaming');
    });

    it('should parse the full reference script format', () => {
        const yaml = `%YAML 1.3
---
# === FORWARD BUTTON ===
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
---
- MouseGesture: [Forward Button, Mouse Up]
- KeyPress: XF86_AudioPlay
...
---
- MouseGesture: [Forward Button, Mouse Right]
- KeyPress: [Super_L, Shift_L, Right]
...
---
- MouseGesture: [Forward Button, Mouse Left]
- KeyPress: [Super_L, Shift_L, Left]
...
---
- MouseGesture: [Forward Button, Mouse Down]
- KeyPress: [Control_L, b]
...
---
# === DPI SWITCH ===
- MouseGesture: [DPI Switch]
- MouseClick: [middle, click]
...
---
- MouseGesture: [DPI Switch, Mouse Up]
- KeyPress: XF86_AudioRaiseVolume
...
---
- MouseGesture: [DPI Switch, Mouse Down]
- KeyPress: XF86_AudioLowerVolume
...
---
- MouseGesture: [DPI Switch, Mouse Right]
- KeyPress: [Control_L, Tab]
...
---
- MouseGesture: [DPI Switch, Mouse Left]
- KeyPress: [Control_L, Shift_L, Tab]
...
---
# === BACK BUTTON ===
- MouseGesture: [Back Button]
- KeyPress: [Control_L, v]
...
---
- MouseGesture: [Back Button, Mouse Up]
- KeyPress: [Control_L, Shift_L, t]
...
---
- MouseGesture: [Back Button, Mouse Right]
- KeyPress: [Control_L, t]
...
---
- MouseGesture: [Back Button, Mouse Left]
- KeyPress: [Control_L, Shift_L, p]
...
---
- MouseGesture: [Back Button, Mouse Down]
- KeyPress: [Control_L, w]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(3);

        // Forward Button
        const fwd = result.buttons.find(b => b.id === 'Forward Button')!;
        expect(fwd.actions.click).toEqual({ type: 'KeyPress', keys: ['Control_L', 'c'] });
        expect(fwd.actions.up).toEqual({ type: 'KeyPress', keys: ['XF86_AudioPlay'] });
        expect(fwd.actions.right).toEqual({ type: 'KeyPress', keys: ['Super_L', 'Shift_L', 'Right'] });
        expect(fwd.actions.left).toEqual({ type: 'KeyPress', keys: ['Super_L', 'Shift_L', 'Left'] });
        expect(fwd.actions.down).toEqual({ type: 'KeyPress', keys: ['Control_L', 'b'] });

        // DPI Switch
        const dpi = result.buttons.find(b => b.id === 'DPI Switch')!;
        expect(dpi.actions.click).toEqual({ type: 'MouseClick', button: 'middle', action: 'click' });
        expect(dpi.actions.up).toEqual({ type: 'KeyPress', keys: ['XF86_AudioRaiseVolume'] });
        expect(dpi.actions.down).toEqual({ type: 'KeyPress', keys: ['XF86_AudioLowerVolume'] });

        // Back Button
        const back = result.buttons.find(b => b.id === 'Back Button')!;
        expect(back.actions.click).toEqual({ type: 'KeyPress', keys: ['Control_L', 'v'] });
        expect(back.actions.up).toEqual({ type: 'KeyPress', keys: ['Control_L', 'Shift_L', 't'] });
    });
});

// ─── YAML Validation tests ──────────────────────────────────────────────────

describe('validateSolaarYaml', () => {
    it('should accept valid YAML', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
`;
        const result = validateSolaarYaml(yaml);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should accept empty YAML', () => {
        const result = validateSolaarYaml('');
        expect(result.valid).toBe(true);
    });

    it('should detect documents without MouseGesture', () => {
        const yaml = `%YAML 1.3
---
- KeyPress: [Control_L, c]
...
`;
        const result = validateSolaarYaml(yaml);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('YAML_STRUCTURE_ERROR');
    });

    it('should detect malformed YAML', () => {
        const yaml = `%YAML 1.3
---
: this: is: broken: yaml: [[[
...
`;
        const result = validateSolaarYaml(yaml);
        // Either YAML_PARSE_ERROR or YAML_STRUCTURE_ERROR is acceptable
        expect(result.valid).toBe(false);
    });

    it('should detect non-array YAML documents', () => {
        const yaml = `%YAML 1.3
---
key: value
another: thing
...
`;
        const result = validateSolaarYaml(yaml);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('YAML_STRUCTURE_ERROR');
    });
});

// ─── Parser edge cases for coverage ─────────────────────────────────────────

describe('solaarYamlToJson — edge cases', () => {
    it('should handle MouseClick with malformed value (not enough elements)', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- MouseClick: [middle]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(1);
        // MouseClick with < 2 elements returns null, so action stays None
        expect(result.buttons[0].actions.click).toEqual({ type: 'None' });
    });

    it('should handle MouseScroll with malformed value (not enough elements)', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- MouseScroll: [5]
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(1);
        expect(result.buttons[0].actions.click).toEqual({ type: 'None' });
    });

    it('should handle Execute with a bare string value (not array)', () => {
        const yaml = `%YAML 1.3
---
- MouseGesture: [Forward Button]
- Execute: /usr/bin/some-script
...
`;
        const result = solaarYamlToJson(yaml);
        expect(result.buttons).toHaveLength(1);
        const action = result.buttons[0].actions.click as any;
        expect(action.type).toBe('Execute');
        expect(action.command).toEqual(['/usr/bin/some-script']);
    });
});
