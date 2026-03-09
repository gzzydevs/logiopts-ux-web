/**
 * Preferences repository — key/value store for user preferences.
 *
 * Stores settings like windowWatcherEnabled, lastActiveProfileId, locale.
 */

import db from '../index.js';

// ─── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
    get: db.prepare('SELECT value FROM preferences WHERE key = ?'),
    set: db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)'),
    getAll: db.prepare('SELECT key, value FROM preferences'),
    delete: db.prepare('DELETE FROM preferences WHERE key = ?'),
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function getPreference(key: string): string | null {
    const row = stmts.get.get(key) as { value: string } | undefined;
    return row?.value ?? null;
}

export function setPreference(key: string, value: string): void {
    stmts.set.run(key, value);
}

export function getAllPreferences(): Record<string, string> {
    const rows = stmts.getAll.all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
        result[row.key] = row.value;
    }
    return result;
}

export function deletePreference(key: string): void {
    stmts.delete.run(key);
}
