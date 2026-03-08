/**
 * Bridge between UI types (ButtonConfig/SolaarAction) and
 * parser types (ButtonMapping/Macro/ProfileConfig).
 *
 * This is the glue that lets the persistence layer speak both languages:
 * - The UI sends ButtonConfig[] with SolaarAction types
 * - The Solaar parser expects ProfileConfig with ButtonMapping[] and Macro types
 * - The DB stores both, and this bridge converts between them
 */

import type {
    ButtonConfig,
    SolaarAction,
    GestureDirection as UIDirection,
} from '../types';

import { CID_MAP } from '../services/deviceDatabase.js';
import { getScriptById } from '../db/repositories/script.repo.js';

import type {
    ProfileConfig,
    ButtonMapping,
    Macro,
    GestureDirection as ParserDirection,
} from '../solaar/schema';

// ─── Direction mapping ───────────────────────────────────────────────────────

const UI_TO_PARSER_DIR: Record<UIDirection, ParserDirection> = {
    None: 'click',
    Up: 'up',
    Down: 'down',
    Left: 'left',
    Right: 'right',
};

const PARSER_TO_UI_DIR: Record<ParserDirection, UIDirection> = {
    click: 'None',
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
};

// ─── Action conversion ──────────────────────────────────────────────────────

/** Convert a SolaarAction (UI) to a Macro (parser) */
function actionToMacro(action: SolaarAction): Macro {
    switch (action.type) {
        case 'None':
            return { type: 'None' };
        case 'KeyPress':
            return { type: 'KeyPress', keys: action.keys };
        case 'MouseClick':
            return {
                type: 'MouseClick',
                button: action.button,
                action: action.count,
            };
        case 'MouseScroll':
            return {
                type: 'MouseScroll',
                horizontal: action.horizontal,
                vertical: action.vertical,
            };
        case 'Execute':
            return { type: 'Execute', command: action.command };
        case 'RunScript': {
            // Resolve script path and emit Solaar Execute directly.
            // Solaar runs subprocess.Popen(args) natively on the host.
            const script = getScriptById(action.scriptId);
            if (!script || !script.path) return { type: 'None' };
            return { type: 'Execute', command: ['bash', script.path] };
        }
        default:
            return { type: 'None' };
    }
}

/** Convert a Macro (parser) to a SolaarAction (UI) */
function macroToAction(macro: Macro): SolaarAction {
    switch (macro.type) {
        case 'None':
            return { type: 'None' };
        case 'KeyPress':
            return { type: 'KeyPress', keys: macro.keys };
        case 'MouseClick':
            return {
                type: 'MouseClick',
                button: macro.button,
                count: macro.action,
            };
        case 'MouseScroll':
            return {
                type: 'MouseScroll',
                horizontal: macro.horizontal,
                vertical: macro.vertical,
            };
        case 'Execute':
            return { type: 'Execute', command: macro.command };
        default:
            return { type: 'None' };
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert ButtonConfig[] (UI format) → ProfileConfig (parser format).
 *
 * Used when persisting: takes the UI representation and produces
 * the parser-compatible structure that jsonToSolaarYaml() expects.
 */
export function buttonConfigsToProfileConfig(
    buttons: ButtonConfig[],
    deviceId: string,
    profile: string,
): ProfileConfig {
    const mappings: ButtonMapping[] = [];

    for (const btn of buttons) {
        const actions: ButtonMapping['actions'] = {};

        if (btn.gestureMode) {
            // Convert each gesture direction
            for (const [uiDir, action] of Object.entries(btn.gestures)) {
                if (action.type === 'None') continue;
                const parserDir = UI_TO_PARSER_DIR[uiDir as UIDirection];
                if (parserDir) {
                    actions[parserDir] = actionToMacro(action);
                }
            }
        } else if (btn.simpleAction && btn.simpleAction.type !== 'None') {
            // Simple action maps to 'click' direction
            actions.click = actionToMacro(btn.simpleAction);
        }

        // Only add if there are actual actions
        if (Object.keys(actions).length > 0) {
            // Resolve Solaar button name from CID map
            const cidMeta = CID_MAP[btn.cid];
            const buttonId = cidMeta?.solaarName ?? `CID-${btn.cid}`;
            mappings.push({ id: buttonId, actions });
        }
    }

    return { deviceId, profile, buttons: mappings };
}

/**
 * Convert ProfileConfig (parser format) → ButtonConfig[] (UI format).
 *
 * Used when loading from DB: takes the parser representation and
 * produces the UI-compatible structure.
 */
export function profileConfigToButtonConfigs(config: ProfileConfig): ButtonConfig[] {
    const results: ButtonConfig[] = [];

    for (const mapping of config.buttons) {
        const gestures: Record<UIDirection, SolaarAction> = {
            None: { type: 'None' },
            Up: { type: 'None' },
            Down: { type: 'None' },
            Left: { type: 'None' },
            Right: { type: 'None' },
        };

        let hasGestures = false;
        let simpleAction: SolaarAction = { type: 'None' };

        for (const [parserDir, macro] of Object.entries(mapping.actions)) {
            const uiDir = PARSER_TO_UI_DIR[parserDir as ParserDirection];
            if (!uiDir) continue;

            const action = macroToAction(macro);

            if (parserDir === 'click' && Object.keys(mapping.actions).length === 1) {
                // Only a click action → simple mode
                simpleAction = action;
            } else {
                hasGestures = true;
                gestures[uiDir] = action;
            }
        }

        // Extract CID from button ID:
        // - Parsed from YAML: Solaar name like "Back Button" → look up in CID_MAP
        // - Saved from UI: "CID-123" format → parse directly
        let cid = 0;
        const cidMatch = mapping.id.match(/CID-(\d+)/);
        if (cidMatch) {
            cid = parseInt(cidMatch[1], 10);
        } else {
            // Find by solaarName
            const entry = Object.entries(CID_MAP).find(([, meta]) => meta.solaarName === mapping.id);
            if (entry) cid = parseInt(entry[0], 10);
        }

        results.push({
            cid,
            gestureMode: hasGestures,
            gestures,
            simpleAction,
        });
    }

    return results;
}
