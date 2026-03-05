/**
 * Config repository — CRUD for the `configs` table.
 *
 * Stores both the JSON (ProfileConfig) and generated YAML for each profile.
 * Integrates with the Solaar parser to generate YAML on save.
 */

import db from '../index';
import { jsonToSolaarYaml } from '../../solaar/index';
import type { ProfileConfig } from '../../solaar/schema';

// ─── Row shape ───────────────────────────────────────────────────────────────

interface ConfigRow {
    id: string;
    profileId: string;
    jsonConfig: string;
    yamlConfig: string;
    appliedAt: string | null;
    updatedAt: string;
}

export interface Config {
    id: string;
    profileId: string;
    jsonConfig: ProfileConfig;
    yamlConfig: string;
    appliedAt: string | null;
    updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToConfig(row: ConfigRow): Config {
    return {
        id: row.id,
        profileId: row.profileId,
        jsonConfig: JSON.parse(row.jsonConfig) as ProfileConfig,
        yamlConfig: row.yamlConfig,
        appliedAt: row.appliedAt,
        updatedAt: row.updatedAt,
    };
}

// ─── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
    upsert: db.prepare(`
        INSERT INTO configs (id, profileId, jsonConfig, yamlConfig, updatedAt)
        VALUES (@id, @profileId, @jsonConfig, @yamlConfig, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            jsonConfig = excluded.jsonConfig,
            yamlConfig = excluded.yamlConfig,
            updatedAt = datetime('now')
    `),

    getByProfile: db.prepare('SELECT * FROM configs WHERE profileId = ? ORDER BY updatedAt DESC LIMIT 1'),

    getLatest: db.prepare('SELECT * FROM configs ORDER BY updatedAt DESC LIMIT 1'),

    markApplied: db.prepare(`UPDATE configs SET appliedAt = datetime('now') WHERE id = ?`),

    deleteByProfile: db.prepare('DELETE FROM configs WHERE profileId = ?'),

    getAll: db.prepare('SELECT * FROM configs ORDER BY updatedAt DESC'),
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save a config for a profile. Generates YAML from the ProfileConfig
 * using the Solaar parser.
 */
export function saveConfig(profileId: string, json: ProfileConfig): Config {
    const yaml = jsonToSolaarYaml(json);
    const id = crypto.randomUUID();

    stmts.upsert.run({
        id,
        profileId,
        jsonConfig: JSON.stringify(json),
        yamlConfig: yaml,
    });

    return {
        id,
        profileId,
        jsonConfig: json,
        yamlConfig: yaml,
        appliedAt: null,
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Save a config with pre-generated YAML (useful when YAML comes from
 * external sources or has been manually edited).
 */
export function saveConfigWithYaml(profileId: string, json: ProfileConfig, yaml: string): Config {
    const id = crypto.randomUUID();

    stmts.upsert.run({
        id,
        profileId,
        jsonConfig: JSON.stringify(json),
        yamlConfig: yaml,
    });

    return {
        id,
        profileId,
        jsonConfig: json,
        yamlConfig: yaml,
        appliedAt: null,
        updatedAt: new Date().toISOString(),
    };
}

export function getConfigByProfile(profileId: string): Config | null {
    const row = stmts.getByProfile.get(profileId) as ConfigRow | undefined;
    return row ? rowToConfig(row) : null;
}

export function getLatestConfig(): Config | null {
    const row = stmts.getLatest.get() as ConfigRow | undefined;
    return row ? rowToConfig(row) : null;
}

export function getAllConfigs(): Config[] {
    const rows = stmts.getAll.all() as ConfigRow[];
    return rows.map(rowToConfig);
}

export function markApplied(id: string): void {
    stmts.markApplied.run(id);
}

export function deleteConfigsByProfile(profileId: string): void {
    stmts.deleteByProfile.run(profileId);
}
