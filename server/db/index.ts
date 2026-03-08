/**
 * SQLite database initialization and singleton.
 *
 * Uses better-sqlite3 for synchronous, fast access.
 * DB file lives at data/logitux.db (configurable via DB_PATH env var).
 *
 * When running inside Electron, LOGITUX_DATA_DIR points to the writable
 * user-data directory (~/.local/share/logitux). In standalone/dev mode
 * it falls back to ./data relative to the project root.
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { DATA_DIR, SCRIPTS_DIR, DB_PATH } from './paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data and scripts directories exist
mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(SCRIPTS_DIR, { recursive: true });

/**
 * On first boot inside a packaged Electron app, copy bundled default scripts
 * from the app resources into the writable user-data scripts directory.
 *
 * LOGITUX_RESOURCES_DIR is set by Electron to process.resourcesPath.
 */
export function ensureUserDataDir(): void {
  mkdirSync(SCRIPTS_DIR, { recursive: true });

  const resourcesScripts = process.env.LOGITUX_RESOURCES_DIR
    ? resolve(process.env.LOGITUX_RESOURCES_DIR, 'scripts')
    : null;

  if (resourcesScripts && existsSync(resourcesScripts)) {
    const existing = readdirSync(SCRIPTS_DIR);
    if (existing.length === 0) {
      cpSync(resourcesScripts, SCRIPTS_DIR, { recursive: true });
      console.log(`[DB] Copied bundled scripts from ${resourcesScripts} to ${SCRIPTS_DIR}`);
    }
  }
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema migrations
const schemaPath = resolve(__dirname, 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');
db.exec(schema);

export default db;
export { DATA_DIR, SCRIPTS_DIR, DB_PATH };
