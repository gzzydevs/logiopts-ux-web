/**
 * Validation for Solaar parser input/output.
 *
 * Every validation function returns a structured result with clear error codes
 * so consumers can programmatically react to issues.
 */

import yaml from 'js-yaml';
import {
    type Macro,
    type ButtonMapping,
    type ProfileConfig,
    type GestureDirection,
    ALL_DIRECTIONS,
    isValidKeysym,
} from './schema';

// ─── Validation types ────────────────────────────────────────────────────────

export interface ValidationError {
    /** JSON-path-like location, e.g. "buttons[0].actions.click" */
    path: string;
    /** Machine-readable code */
    code:
    | 'INVALID_KEYSYM'
    | 'EMPTY_KEYS'
    | 'INVALID_BUTTON_NAME'
    | 'INVALID_DIRECTION'
    | 'INVALID_MACRO_TYPE'
    | 'INVALID_MOUSE_BUTTON'
    | 'EMPTY_COMMAND'
    | 'MISSING_DEVICE_ID'
    | 'MISSING_PROFILE'
    | 'YAML_PARSE_ERROR'
    | 'YAML_STRUCTURE_ERROR';
    /** Human-readable message */
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

// ─── Macro validation ────────────────────────────────────────────────────────

export function validateMacro(macro: Macro, path: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!macro || typeof macro !== 'object' || !('type' in macro)) {
        errors.push({ path, code: 'INVALID_MACRO_TYPE', message: 'Macro must be an object with a "type" field' });
        return errors;
    }

    switch (macro.type) {
        case 'None':
            break;

        case 'KeyPress':
            if (!Array.isArray(macro.keys) || macro.keys.length === 0) {
                errors.push({ path, code: 'EMPTY_KEYS', message: 'KeyPress macro must have at least one key' });
            } else {
                for (const key of macro.keys) {
                    if (!isValidKeysym(key)) {
                        errors.push({
                            path,
                            code: 'INVALID_KEYSYM',
                            message: `Unknown keysym: "${key}"`,
                        });
                    }
                }
            }
            break;

        case 'MouseClick':
            if (!['left', 'middle', 'right'].includes(macro.button)) {
                errors.push({ path, code: 'INVALID_MOUSE_BUTTON', message: `Invalid mouse button: "${macro.button}"` });
            }
            break;

        case 'MouseScroll':
            // horizontal and vertical are numbers — no extra validation needed
            break;

        case 'Execute':
            if (!Array.isArray(macro.command) || macro.command.length === 0) {
                errors.push({ path, code: 'EMPTY_COMMAND', message: 'Execute macro must have at least one command element' });
            }
            break;

        default:
            errors.push({ path, code: 'INVALID_MACRO_TYPE', message: `Unknown macro type: "${(macro as any).type}"` });
    }

    return errors;
}

// ─── ProfileConfig validation ────────────────────────────────────────────────

export function validateProfileConfig(config: ProfileConfig): ValidationResult {
    const errors: ValidationError[] = [];

    if (!config.deviceId || typeof config.deviceId !== 'string') {
        errors.push({ path: 'deviceId', code: 'MISSING_DEVICE_ID', message: 'deviceId is required' });
    }

    if (!config.profile || typeof config.profile !== 'string') {
        errors.push({ path: 'profile', code: 'MISSING_PROFILE', message: 'profile is required' });
    }

    if (Array.isArray(config.buttons)) {
        for (let i = 0; i < config.buttons.length; i++) {
            const btn = config.buttons[i];
            const btnPath = `buttons[${i}]`;

            if (!btn.id || typeof btn.id !== 'string') {
                errors.push({ path: `${btnPath}.id`, code: 'INVALID_BUTTON_NAME', message: 'Button id is required' });
            }

            if (btn.actions && typeof btn.actions === 'object') {
                for (const [dir, macro] of Object.entries(btn.actions)) {
                    if (!ALL_DIRECTIONS.includes(dir as GestureDirection)) {
                        errors.push({
                            path: `${btnPath}.actions.${dir}`,
                            code: 'INVALID_DIRECTION',
                            message: `Invalid direction: "${dir}". Must be one of: ${ALL_DIRECTIONS.join(', ')}`,
                        });
                        continue;
                    }
                    errors.push(...validateMacro(macro as any, `${btnPath}.actions.${dir}`));
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

// ─── YAML string validation ─────────────────────────────────────────────────

export function validateSolaarYaml(yamlStr: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!yamlStr || !yamlStr.trim()) {
        return { valid: true, errors: [] }; // Empty YAML is valid (no rules)
    }

    // Strip YAML version header for parsing
    const stripped = yamlStr.replace(/^%YAML[^\n]*\n/, '');

    // Split into documents by --- / ...
    const docs = stripped.split(/\n?---\n?/).filter(d => d.trim() && d.trim() !== '...');

    for (let i = 0; i < docs.length; i++) {
        const docStr = docs[i].replace(/\.\.\.\s*$/, '').trim();
        if (!docStr) continue;

        try {
            const doc = yaml.load(docStr);

            if (!Array.isArray(doc)) {
                errors.push({
                    path: `document[${i}]`,
                    code: 'YAML_STRUCTURE_ERROR',
                    message: 'Each YAML document must be a list',
                });
                continue;
            }

            // Check for at least a MouseGesture condition
            const hasCondition = doc.some(
                (item: any) => item && typeof item === 'object' && ('MouseGesture' in item)
            );

            if (!hasCondition) {
                errors.push({
                    path: `document[${i}]`,
                    code: 'YAML_STRUCTURE_ERROR',
                    message: 'Each document must contain a MouseGesture condition',
                });
            }
        } catch (e) {
            errors.push({
                path: `document[${i}]`,
                code: 'YAML_PARSE_ERROR',
                message: `Failed to parse YAML document: ${e instanceof Error ? e.message : String(e)}`,
            });
        }
    }

    return { valid: errors.length === 0, errors };
}
