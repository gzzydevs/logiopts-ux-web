/**
 * Generates Solaar config.yaml and rules.yaml from our ButtonConfig model.
 */
import yaml from 'js-yaml';
import type { SolaarConfig, SolaarRule, SolaarAction, ButtonConfig, GestureDirection } from '../types.js';

// ─── Solaar rules.yaml generation ────────────────────────────────────────────

/** Direction string as Solaar expects it in MouseGesture conditions */
const DIRECTION_MAP: Record<GestureDirection, string | null> = {
  None: null,   // click = empty list means just a diverted click
  Up: 'Mouse Up',
  Down: 'Mouse Down',
  Left: 'Mouse Left',
  Right: 'Mouse Right',
};

/** Convert one SolaarAction to the YAML representation Solaar expects */
function actionToYaml(action: SolaarAction): any {
  switch (action.type) {
    case 'None':
      return null;
    case 'KeyPress':
      // Solaar syntax: [key1, key2, ...]  — just the key list
      return action.keys;
    case 'MouseClick':
      return { 'mouse-click': action.button, 'count': action.count };
    case 'MouseScroll':
      return { 'mouse-scroll': [action.horizontal, action.vertical] };
    case 'Execute':
      return action.command;
    default:
      return null;
  }
}

/** Build a single Solaar rule entry (used inside rules.yaml) */
function buildRule(condition: SolaarRule['condition'], action: SolaarAction, comment?: string): any {
  const rule: any[] = [];

  if (comment) {
    rule.push(comment);
  }

  // Condition
  if (condition.type === 'MouseGesture') {
    // ['Mouse Gesture', ...directions] or ['Mouse Gesture'] for click
    const mg = ['Mouse Gesture', ...condition.directions];
    rule.push(mg);
  } else if (condition.type === 'Key') {
    rule.push({ 'Key': [condition.key, condition.event || 'pressed'] });
  }

  // Action
  const yamlAction = actionToYaml(action);
  if (yamlAction !== null) {
    // For KeyPress: wrap in KeyPress action type
    if (action.type === 'KeyPress') {
      rule.push({ 'KeyPress': yamlAction });
    } else if (action.type === 'MouseClick') {
      rule.push({ 'MouseClick': [action.button, action.count] });
    } else if (action.type === 'MouseScroll') {
      rule.push({ 'MouseScroll': [action.horizontal, action.vertical] });
    } else if (action.type === 'Execute') {
      rule.push({ 'Execute': yamlAction });
    }
  }

  return { Rule: rule };
}

/** Generate rules.yaml content from an array of ButtonConfig */
export function generateRulesYaml(buttons: ButtonConfig[]): string {
  const rules: any[] = [];

  for (const btn of buttons) {
    if (btn.gestureMode) {
      // Gesture mode: generate one rule per direction that has an action
      for (const [dir, action] of Object.entries(btn.gestures)) {
        if (action.type === 'None') continue;
        const direction = dir as GestureDirection;
        const dirs = DIRECTION_MAP[direction];
        const condition = {
          type: 'MouseGesture' as const,
          directions: dirs ? [dirs] : [],  // [] = click
        };
        const comment = `CID ${btn.cid} — ${direction === 'None' ? 'Click' : direction}`;
        rules.push(buildRule(condition, action, comment));
      }
    } else if (btn.simpleAction.type !== 'None') {
      // Simple diverted button: fire on diverted key press
      // For diverted (non-gesture) buttons we use a key condition
      // But simple divert rules also use Mouse Gesture with empty directions for a click
      const condition = {
        type: 'MouseGesture' as const,
        directions: [] as string[],
      };
      rules.push(buildRule(condition, btn.simpleAction, `CID ${btn.cid} — Click`));
    }
  }

  // Solaar rules.yaml is a single document with a top-level list %YAML 1.3
  const content = yaml.dump(rules, {
    flowLevel: 3,
    lineWidth: 200,
    noRefs: true,
  });

  return `%YAML 1.3\n---\n${content}`;
}

// ─── Solaar config.yaml generation ───────────────────────────────────────────

/**
 * Merge our settings into an existing Solaar config.yaml.
 * We only touch the specific device's divert-keys and dpi settings.
 */
export function generateConfigYaml(
  existingYaml: string,
  config: SolaarConfig
): string {
  let doc: any;
  try {
    doc = yaml.load(existingYaml) || {};
  } catch {
    doc = {};
  }

  // Ensure top-level structure
  if (typeof doc !== 'object') doc = {};

  // Find or create the device entry under its unit ID
  // Solaar config.yaml structure varies — look for the device key
  // The config stores per-device settings, keyed by either name or unit ID
  // We need to update divert-keys and sensitivity (DPI)
  
  // Look through all keys for our device (by unit ID or device name)
  let deviceKey: string | undefined;
  for (const key of Object.keys(doc)) {
    const entry = doc[key];
    if (typeof entry === 'object' && entry !== null) {
      // Check if this entry has our unit ID or matches device name
      if (key === config.unitId || key === config.deviceName || 
          entry._unitId === config.unitId) {
        deviceKey = key;
        break;
      }
    }
  }

  if (!deviceKey) {
    // Create new device entry keyed by unit ID
    deviceKey = config.unitId;
    doc[deviceKey] = {};
  }

  const dev = doc[deviceKey];

  // Set divert-keys
  const divertKeys: Record<string, number> = {};
  for (const [cid, mode] of Object.entries(config.divertKeys)) {
    divertKeys[cid] = mode;
  }
  dev['divert-keys'] = divertKeys;

  // Set DPI
  dev['dpi'] = config.dpi;

  return yaml.dump(doc, { lineWidth: 200, noRefs: true });
}

/**
 * Parse an existing rules.yaml back into SolaarRule[] 
 * (for reading current config).
 */
export function parseRulesYaml(content: string): SolaarRule[] {
  if (!content.trim()) return [];

  let docs: any;
  try {
    docs = yaml.load(content.replace(/^%YAML.*\n---\n/, ''));
  } catch {
    return [];
  }

  if (!Array.isArray(docs)) return [];

  const rules: SolaarRule[] = [];

  for (const item of docs) {
    if (!item || !item.Rule || !Array.isArray(item.Rule)) continue;
    const parts = item.Rule;
    let comment: string | undefined;
    let condition: SolaarRule['condition'] | undefined;
    let action: SolaarAction = { type: 'None' };

    for (const part of parts) {
      // String = comment
      if (typeof part === 'string') {
        comment = part;
        continue;
      }

      // Array starting with 'Mouse Gesture' = MouseGesture condition
      if (Array.isArray(part) && part[0] === 'Mouse Gesture') {
        condition = {
          type: 'MouseGesture',
          directions: part.slice(1),
        };
        continue;
      }

      // Object with known action keys
      if (typeof part === 'object' && part !== null) {
        if (part.Key) {
          condition = {
            type: 'Key',
            key: part.Key[0],
            event: part.Key[1],
          };
        } else if (part.KeyPress) {
          action = { type: 'KeyPress', keys: part.KeyPress };
        } else if (part.MouseClick) {
          action = { type: 'MouseClick', button: part.MouseClick[0], count: part.MouseClick[1] };
        } else if (part.MouseScroll) {
          action = { type: 'MouseScroll', horizontal: part.MouseScroll[0], vertical: part.MouseScroll[1] };
        } else if (part.Execute) {
          action = { type: 'Execute', command: part.Execute };
        }
      }
    }

    if (condition) {
      rules.push({ comment, condition, action });
    }
  }

  return rules;
}
