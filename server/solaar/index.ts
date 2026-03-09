/**
 * Public API for the Solaar parser module.
 *
 * Usage:
 *   import { jsonToSolaarYaml, solaarYamlToJson } from './solaar';
 *
 *   const yaml = jsonToSolaarYaml(config);
 *   const json = solaarYamlToJson(yaml);
 *
 * TODO: wire persistence module when ready (currently returns string only).
 */

// Parser
export { jsonToSolaarYaml, solaarYamlToJson, normalizeConfig } from './parser.js';

// Validation
export { validateProfileConfig, validateSolaarYaml } from './validator.js';
export type { ValidationError, ValidationResult } from './validator.js';

// Schema types
export type {
    Macro,
    ButtonMapping,
    ProfileConfig,
    SolaarRuleDoc,
    GestureDirection,
} from './schema.js';
export { ALL_DIRECTIONS, isValidKeysym } from './schema.js';
