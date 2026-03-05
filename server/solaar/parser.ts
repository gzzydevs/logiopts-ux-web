/**
 * Core parser: JSON ⇄ Solaar YAML conversion.
 *
 * Produces multi-document YAML matching the real Solaar rules.yaml format:
 *   %YAML 1.3
 *   ---
 *   - MouseGesture: [ButtonName]
 *   - KeyPress: [Control_L, c]
 *   ...
 *
 * TODO: replace string output with persistence module when ready.
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

/** Build the MouseGesture YAML value for a button + direction */
function buildMouseGesture(buttonName: string, direction: GestureDirection): any[] {
    const parts: string[] = [buttonName];
    const dirStr = SOLAAR_DIRECTION_MAP[direction];
    if (dirStr) parts.push(dirStr);
    return parts;
}

/** Convert a Macro to the YAML action entry (the value after the action key) */
function macroToYamlEntry(macro: Macro): { key: string; value: any } | null {
    switch (macro.type) {
        case 'KeyPress':
            // Solaar: single key → bare string, multiple keys → array
            return {
                key: 'KeyPress',
                value: macro.keys.length === 1 ? macro.keys[0] : macro.keys,
            };

        case 'MouseClick':
            return {
                key: 'MouseClick',
                value: [macro.button, macro.action],
            };

        case 'MouseScroll':
            return {
                key: 'MouseScroll',
                value: [macro.horizontal, macro.vertical],
            };

        case 'Execute':
            return {
                key: 'Execute',
                value: macro.command,
            };

        default:
            // None or unknown — should not reach here (caller skips None)
            return null;
    }
}

// Solaar trigger events that should NOT be treated as keys
const SOLAAR_EVENTS = new Set(['click', 'depress', 'release']);

/** Parse a single YAML action entry back into a Macro */
function yamlEntryToMacro(item: any): Macro | null {
    if (!item || typeof item !== 'object') return null;

    if ('KeyPress' in item) {
        const val = item.KeyPress;
        // val can be: a string, an array of strings, or an array of [array, string]
        // e.g. [[Control_L, Shift_L, t], click] → keys=["Control_L,Shift_L,t"], stripping "click" event
        let rawKeys: string[] = Array.isArray(val) ? val.map((k: any) =>
            Array.isArray(k) ? k.join(',') : String(k)
        ) : [String(val)];
        // Filter out Solaar trigger events (click, depress, release)
        rawKeys = rawKeys.filter(k => !SOLAAR_EVENTS.has(k));
        if (rawKeys.length === 0) rawKeys = ['click']; // fallback if only event was present
        return { type: 'KeyPress', keys: rawKeys };
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
 * Convert a ProfileConfig to Solaar-compatible multi-document YAML.
 *
 * Each button/direction pair with a non-None action becomes a separate
 * YAML document delimited by `---` and `...`.
 */
export function jsonToSolaarYaml(config: ProfileConfig): string {
    const docs: string[] = [];
    let lastButtonId: string | null = null;

    for (const button of config.buttons) {
        // Deterministic direction order
        for (const dir of ALL_DIRECTIONS) {
            const macro = button.actions[dir];
            if (!macro || macro.type === 'None') continue;

            const actionEntry = macroToYamlEntry(macro);
            if (!actionEntry) continue;

            // Build the YAML document as a list of objects
            const mg = buildMouseGesture(button.id, dir);
            const items: any[] = [
                { MouseGesture: mg },
                { [actionEntry.key]: actionEntry.value },
            ];

            // Serialize with js-yaml (flow for inner values)
            const yamlBody = yaml.dump(items, {
                flowLevel: 2,
                lineWidth: 200,
                noRefs: true,
            }).trimEnd();

            // Add section comment when button changes
            let comment = '';
            if (button.id !== lastButtonId) {
                comment = `# === ${button.id.toUpperCase()} ===\n`;
                lastButtonId = button.id;
            }

            docs.push(`${comment}${yamlBody}`);
        }
    }

    if (docs.length === 0) {
        return '%YAML 1.3\n---\n...\n';
    }

    const body = docs.map(d => `---\n${d}\n...`).join('\n');
    return `%YAML 1.3\n${body}\n`;
}

// ─── YAML → JSON ─────────────────────────────────────────────────────────────

/**
 * Parse a Solaar rules.yaml string back into a ProfileConfig.
 *
 * Groups rules by button name, reconstructing the ButtonMapping structure.
 * Unknown fields in the YAML are silently ignored.
 */
export function solaarYamlToJson(
    yamlStr: string,
    deviceId: string = 'unknown',
    profile: string = 'default',
): ProfileConfig {
    if (!yamlStr || !yamlStr.trim()) {
        return { deviceId, profile, buttons: [] };
    }

    // Strip YAML version header
    const stripped = yamlStr.replace(/^%YAML[^\n]*\n/, '');

    // Split into documents
    const rawDocs = stripped.split(/\n?---\n?/).filter(d => d.trim() && d.trim() !== '...');

    // Parse each document into SolaarRuleDoc
    const ruleDocs: SolaarRuleDoc[] = [];

    for (const rawDoc of rawDocs) {
        const docStr = rawDoc.replace(/\.\.\.\s*$/, '').trim();
        if (!docStr) continue;

        // Strip comment lines for parsing, but capture first comment
        const lines = docStr.split('\n');
        const commentLine = lines.find(l => l.trim().startsWith('#'));
        const comment = commentLine ? commentLine.replace(/^#\s*/, '').trim() : undefined;

        let doc: any;
        try {
            doc = yaml.load(docStr);
        } catch {
            continue; // Skip malformed documents
        }

        if (!Array.isArray(doc)) continue;

        // Extract MouseGesture condition and action
        let buttonName: string | null = null;
        let direction: GestureDirection = 'click';
        let action: Macro = { type: 'None' };

        for (const item of doc) {
            if (!item || typeof item !== 'object') continue;

            // MouseGesture condition
            // Can be a string (e.g. "Back Button" for click) or array (["Back Button", "Mouse Up"])
            if ('MouseGesture' in item) {
                const mg = item.MouseGesture;
                if (typeof mg === 'string') {
                    // Simple click gesture: MouseGesture: "Back Button"
                    buttonName = mg;
                    direction = 'click';
                } else if (Array.isArray(mg) && mg.length >= 1) {
                    buttonName = String(mg[0]);
                    if (mg.length >= 2) {
                        const dirStr = String(mg[1]);
                        direction = REVERSE_DIRECTION_MAP[dirStr] || 'click';
                    }
                }
                continue;
            }

            // Action
            const parsed = yamlEntryToMacro(item);
            if (parsed) {
                action = parsed;
            }
        }

        if (buttonName) {
            ruleDocs.push({ buttonName, direction, action, comment });
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
