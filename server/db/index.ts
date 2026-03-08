/**
 * SQLite database initialization and singleton.
 *
 * Uses better-sqlite3 for synchronous, fast access.
 * DB file lives at DATA_DIR/logitux.db — see paths.ts for resolution logic.
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { DB_PATH, SCRIPTS_DIR } from './paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema migrations
const schemaPath = resolve(__dirname, 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');
db.exec(schema);

/**
 * Ensure user-data directories exist and, on first install via Electron,
 * copy bundled default scripts from the app resources into SCRIPTS_DIR.
 */
export function ensureUserDataDir(): void {
  mkdirSync(SCRIPTS_DIR, { recursive: true });

  const resourcesScripts = process.env.LOGITUX_RESOURCES_DIR
    ? resolve(process.env.LOGITUX_RESOURCES_DIR, 'scripts')
    : null;

  if (resourcesScripts && existsSync(resourcesScripts)) {
    const files = readdirSync(SCRIPTS_DIR);
    if (files.length === 0) {
      cpSync(resourcesScripts, SCRIPTS_DIR, { recursive: true });
    }
  }
}

export default db;
export { DB_PATH, SCRIPTS_DIR };
