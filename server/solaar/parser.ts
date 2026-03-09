/**
 * Core parser: JSON ⇄ Solaar YAML conversion.
 *
 * Produces a single-document YAML matching the real Solaar rules.yaml format:
 *   %YAML 1.3
 *   ---
 *   - Rule:
 *     - MouseGesture: ButtonName
 *     - KeyPress:
 *       - [Control_L, c]
 *       - click
 *   ...
 */

import yaml from 'js-yaml';
import {
    type Macro,
    type ButtonMapping,
    type ProfileConfig,
    type SolaarRuleDoc,
    type GestureDirection,
    ALL_DIRECTIONS,
    SOLAAR_DIRECTION_MAP,
    REVERSE_DIRECTION_MAP,
} from './schema';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Solaar trigger events that should NOT be treated as keys
const SOLAAR_EVENTS = new Set(['click', 'depress', 'release']);

/** Parse a single YAML action entry back into a Macro */
function yamlEntryToMacro(item: any): Macro | null {
    if (!item || typeof item !== 'object') return null;

    if ('KeyPress' in item) {
        const val = item.KeyPress;
        // val is either:
        //   a string                → single key,  e.g. "XF86_AudioPlay"
        //   an array of items       → each item is a chord or a trigger event
        //     - string item         → single key or trigger ("click")
        //     - array item          → chord, e.g. ["Control_L", "c"]
        // We collect all non-trigger items and flatten chords into the keys array.
        const keys: string[] = [];
        const items: any[] = Array.isArray(val) ? val : [val];
        for (const k of items) {
            if (Array.isArray(k)) {
                // Inline chord array — each element is a key of the chord
                keys.push(...k.map(String));
            } else {
                const s = String(k);
                if (!SOLAAR_EVENTS.has(s)) keys.push(s);
            }
        }
        if (keys.length === 0) return null;
        return { type: 'KeyPress', keys };
    }

    if ('MouseClick' in item) {
        const val = item.MouseClick;
        if (Array.isArray(val) && val.length >= 2) {
            return { type: 'MouseClick', button: val[0], action: val[1] };
        }
        return null;
    }

    if ('MouseScroll' in item) {
        const val = item.MouseScroll;
        if (Array.isArray(val) && val.length >= 2) {
            return { type: 'MouseScroll', horizontal: val[0], vertical: val[1] };
        }
        return null;
    }

    if ('Execute' in item) {
        const val = item.Execute;
        return { type: 'Execute', command: Array.isArray(val) ? val : [String(val)] };
    }

    return null;
}

// ─── JSON → YAML ─────────────────────────────────────────────────────────────

/**
 * Render a Macro as the indented YAML lines that go inside a `- Rule:` block.
 *
 * Produces the exact format Solaar 1.x expects:
 *   KeyPress  → block sequence with optional inner inline array + `click` trigger
 *   MouseClick / MouseScroll / Execute → single inline-array line
 */
function macroToRuleLines(macro: Macro): string[] {
    switch (macro.type) {
        case 'KeyPress': {
            // keys[] is the chord: multiple keys = pressed simultaneously = inline array
            // Single key = plain string.  Always append the "click" trigger event.
            const lines: string[] = ['  - KeyPress:'];
            if (macro.keys.length > 1) {
                lines.push(`    - [${macro.keys.join(', ')}]`);
            } else {
                lines.push(`    - ${macro.keys[0]}`);
            }
            lines.push('    - click');
            return lines;
        }
        case 'MouseClick':
            return [`  - MouseClick: [${macro.button}, ${macro.action}]`];
        case 'MouseScroll':
            return [`  - MouseScroll: [${macro.horizontal}, ${macro.vertical}]`];
        case 'Execute':
            return [`  - Execute: [${macro.command.join(', ')}]`];
        default:
            return [];
    }
}

/**
 * Convert a ProfileConfig to Solaar-compatible YAML.
 *
 * Produces a SINGLE document with a list of `- Rule:` entries, exactly
 * matching the format Solaar 1.x writes and reads:
 *
 *   %YAML 1.3
 *   ---
 *   - Rule:
 *     - MouseGesture: Back Button
 *     - KeyPress:
 *       - [Control_L, v]
 *       - click
 *   - Rule:
 *     - MouseGesture: [Back Button, Mouse Up]
 *     - KeyPress:
 *       - [Control_L, Shift_L, t]
 *       - click
 *   ...
 */
export function jsonToSolaarYaml(config: ProfileConfig): string {
    const ruleLines: string[] = [];

    for (const button of config.buttons) {
        for (const dir of ALL_DIRECTIONS) {
            const macro = button.actions[dir];
            if (!macro || macro.type === 'None') continue;

            const actionLines = macroToRuleLines(macro);
            if (actionLines.length === 0) continue;

            // MouseGesture: plain string for click, inline array for directional
            const dirStr = SOLAAR_DIRECTION_MAP[dir];
            const mgValue = dirStr
                ? `[${button.id}, ${dirStr}]`
                : button.id;

            ruleLines.push('- Rule:');
            ruleLines.push(`  - MouseGesture: ${mgValue}`);
            ruleLines.push(...actionLines);
        }
    }

    if (ruleLines.length === 0) {
        return '%YAML 1.3\n---\n...\n';
    }

    return `%YAML 1.3\n---\n${ruleLines.join('\n')}\n...\n`;
}

// ─── YAML → JSON ─────────────────────────────────────────────────────────────

/** Extract button name + direction + action from a flat Rule item list */
function extractRuleFromItems(items: any[]): SolaarRuleDoc | null {
    let buttonName: string | null = null;
    let direction: GestureDirection = 'click';
    let action: Macro = { type: 'None' };

    for (const item of items) {
        if (!item || typeof item !== 'object') continue;

        if ('MouseGesture' in item) {
            const mg = item.MouseGesture;
            if (typeof mg === 'string') {
                buttonName = mg;
                direction = 'click';
            } else if (Array.isArray(mg) && mg.length >= 1) {
                buttonName = String(mg[0]);
                direction = mg.length >= 2
                    ? (REVERSE_DIRECTION_MAP[String(mg[1])] ?? 'click')
                    : 'click';
            }
            continue;
        }

        const parsed = yamlEntryToMacro(item);
        if (parsed) action = parsed;
    }

    return buttonName ? { buttonName, direction, action } : null;
}

/**
 * Parse a Solaar rules.yaml string back into a ProfileConfig.
 *
 * Handles two formats:
 *   1. Real Solaar format — single `---` doc, list of `- Rule:` entries:
 *        [{Rule: [{MouseGesture:…}, {KeyPress:…}]}, {Rule:[…]}, …]
 *   2. Legacy/test format — multi-doc (one `---…---` block per rule):
 *        flat [{MouseGesture:…}, {KeyPress:…}] per YAML document
 */
export function solaarYamlToJson(
    yamlStr: string,
    deviceId: string = 'unknown',
    profile: string = 'default',
): ProfileConfig {
    if (!yamlStr || !yamlStr.trim()) {
        return { deviceId, profile, buttons: [] };
    }

    const ruleDocs: SolaarRuleDoc[] = [];

    // Strip YAML version header and split into YAML documents
    const stripped = yamlStr.replace(/^%YAML[^\n]*\n/, '');
    const rawDocs = stripped.split(/\n?---\n?/).filter(d => d.trim() && d.trim() !== '...');

    for (const rawDoc of rawDocs) {
        const docStr = rawDoc.replace(/\.\.\.\s*$/, '').trim();
        if (!docStr) continue;

        let doc: any;
        try {
            doc = yaml.load(docStr);
        } catch {
            continue;
        }

        if (!Array.isArray(doc)) continue;

        // Detect real Solaar format: every top-level item is { Rule: [...] }
        const allRuleWrapped = doc.length > 0 &&
            doc.every((item: any) =>
                item !== null &&
                typeof item === 'object' &&
                'Rule' in item &&
                Array.isArray(item.Rule)
            );

        if (allRuleWrapped) {
            // Single doc, multiple Rules — iterate each Rule entry
            for (const ruleItem of doc) {
                const rule = extractRuleFromItems(ruleItem.Rule);
                if (rule) ruleDocs.push(rule);
            }
        } else {
            // Legacy format: flat list (possibly one Rule wrapper or no wrapper)
            let items = doc;
            if (
                items.length >= 1 &&
                items[0] !== null &&
                typeof items[0] === 'object' &&
                'Rule' in items[0] &&
                Array.isArray(items[0].Rule)
            ) {
                items = items[0].Rule;
            }
            const rule = extractRuleFromItems(items);
            if (rule) ruleDocs.push(rule);
        }
    }

    // Group by button name → ButtonMapping[]
    const buttonMap = new Map<string, ButtonMapping>();
    for (const rule of ruleDocs) {
        let btn = buttonMap.get(rule.buttonName);
        if (!btn) {
            btn = { id: rule.buttonName, actions: {} };
            buttonMap.set(rule.buttonName, btn);
        }
        btn.actions[rule.direction] = rule.action;
    }

    return {
        deviceId,
        profile,
        buttons: Array.from(buttonMap.values()),
    };
}

// ─── Normalize ───────────────────────────────────────────────────────────────

/**
 * Normalize a ProfileConfig for deterministic comparison.
 *
 * - Sorts buttons alphabetically by id
 * - Fills missing directions with { type: 'None' }
 * - Removes { type: 'None' } entries (so two configs that differ only in
 *   explicit vs implicit None are considered equal)
 */
export function normalizeConfig(config: ProfileConfig): ProfileConfig {
    const buttons: ButtonMapping[] = config.buttons
        .map(btn => {
            const actions: ButtonMapping['actions'] = {};
            for (const dir of ALL_DIRECTIONS) {
                const macro = btn.actions[dir];
                if (macro && macro.type !== 'None') {
                    actions[dir] = macro;
                }
            }
            return { id: btn.id, actions };
        })
        // Remove buttons with zero actions
        .filter(btn => Object.keys(btn.actions).length > 0)
        // Sort alphabetically for determinism
        .sort((a, b) => a.id.localeCompare(b.id));

    return {
        deviceId: config.deviceId,
        profile: config.profile,
        buttons,
    };
}
