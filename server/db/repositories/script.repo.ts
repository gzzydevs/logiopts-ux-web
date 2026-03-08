/**
 * Script repository — CRUD for the `scripts` table.
 *
 * Keeps scripts in DB as source of truth and syncs with disk
 * (scripts/ directory) so scriptRunner.ts can execute them.
 */

import db from '../index';
import { SCRIPTS_DIR } from '../paths.js';
import { writeFileSync, unlinkSync, chmodSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Row shape ───────────────────────────────────────────────────────────────

interface ScriptRow {
    id: string;
    name: string;
    path: string;
    content: string;
    executable: number;
    createdAt: string;
    updatedAt: string;
}

export interface Script {
    id: string;
    name: string;
    path: string;
    content: string;
    executable: boolean;
    createdAt: string;
    updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToScript(row: ScriptRow): Script {
    return {
        id: row.id,
        name: row.name,
        path: row.path,
        content: row.content,
        executable: row.executable === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** Basic safety check: reject scripts with dangerous commands */
const DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\//,           // rm -rf /
    /mkfs\./,                   // mkfs.*
    /dd\s+if=.*of=\/dev\//,    // dd to device
    /:\(\)\{ :\|:& \};:/,          // fork bomb
    />\s*\/dev\/sd/,           // write to block device
];

function validateScriptContent(content: string): string | null {
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
            return `Script contains potentially dangerous command: ${pattern.source}`;
        }
    }
    return null;
}

/** Write script content to disk and make executable if needed */
function syncToDisk(name: string, content: string, executable: boolean): string {
    const scriptPath = resolve(SCRIPTS_DIR, name);
    writeFileSync(scriptPath, content, 'utf-8');
    if (executable) {
        chmodSync(scriptPath, 0o755);
    }
    return scriptPath;
}

// ─── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
    insert: db.prepare(`
        INSERT INTO scripts (id, name, path, content, executable, createdAt, updatedAt)
        VALUES (@id, @name, @path, @content, @executable, @createdAt, @updatedAt)
    `),

    update: db.prepare(`
        UPDATE scripts SET
            name = @name,
            path = @path,
            content = @content,
            executable = @executable,
            updatedAt = @updatedAt
        WHERE id = @id
    `),

    getAll: db.prepare('SELECT * FROM scripts ORDER BY name'),

    getById: db.prepare('SELECT * FROM scripts WHERE id = ?'),

    getByName: db.prepare('SELECT * FROM scripts WHERE name = ?'),

    deleteById: db.prepare('DELETE FROM scripts WHERE id = ?'),
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function createScript(data: { name: string; content: string; executable?: boolean }): Script {
    const validation = validateScriptContent(data.content);
    if (validation) {
        throw new Error(validation);
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const executable = data.executable ?? true;
    const path = syncToDisk(data.name, data.content, executable);

    stmts.insert.run({
        id,
        name: data.name,
        path,
        content: data.content,
        executable: executable ? 1 : 0,
        createdAt: now,
        updatedAt: now,
    });

    return { id, name: data.name, path, content: data.content, executable, createdAt: now, updatedAt: now };
}

export function updateScript(id: string, changes: { name?: string; content?: string; executable?: boolean }): Script | null {
    const existing = getScriptById(id);
    if (!existing) return null;

    if (changes.content) {
        const validation = validateScriptContent(changes.content);
        if (validation) {
            throw new Error(validation);
        }
    }

    const now = new Date().toISOString();
    const updated: Script = {
        ...existing,
        ...changes,
        updatedAt: now,
    };

    // If name changed, remove old file
    if (changes.name && changes.name !== existing.name) {
        try { unlinkSync(existing.path); } catch { /* ok if missing */ }
    }

    updated.path = syncToDisk(updated.name, updated.content, updated.executable);

    stmts.update.run({
        id,
        name: updated.name,
        path: updated.path,
        content: updated.content,
        executable: updated.executable ? 1 : 0,
        updatedAt: now,
    });

    return updated;
}

export function getAllScripts(): Script[] {
    const rows = stmts.getAll.all() as ScriptRow[];
    return rows.map(rowToScript);
}

export function getScriptById(id: string): Script | null {
    const row = stmts.getById.get(id) as ScriptRow | undefined;
    return row ? rowToScript(row) : null;
}

export function getScriptByName(name: string): Script | null {
    const row = stmts.getByName.get(name) as ScriptRow | undefined;
    return row ? rowToScript(row) : null;
}

export function deleteScript(id: string): void {
    const existing = getScriptById(id);
    if (existing) {
        try { unlinkSync(existing.path); } catch { /* ok if missing */ }
    }
    stmts.deleteById.run(id);
}

/**
 * Seed DB from scripts/ directory on first boot.
 * Only imports scripts that aren't already in the DB.
 */
export function seedFromDisk(): number {
    let imported = 0;
    try {
        const files = readdirSync(SCRIPTS_DIR);
        for (const file of files) {
            if (!file.endsWith('.sh') && !file.endsWith('.py') && !file.endsWith('.js')) continue;

            const existingRow = stmts.getByName.get(file) as ScriptRow | undefined;
            if (existingRow) continue;

            const filePath = resolve(SCRIPTS_DIR, file);
            const content = readFileSync(filePath, 'utf-8');
            const now = new Date().toISOString();
            const id = crypto.randomUUID();

            stmts.insert.run({
                id,
                name: file,
                path: filePath,
                content,
                executable: 1,
                createdAt: now,
                updatedAt: now,
            });
            imported++;
        }
    } catch {
        // scripts dir might not exist yet
    }
    return imported;
}
