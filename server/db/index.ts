/**
 * SQLite database initialization and singleton.
 *
 * Uses better-sqlite3 for synchronous, fast access.
 *
 * Data directory resolution:
 *   1. LOGITUX_DATA_DIR env var (explicit override)
 *   2. LOGITUX_DEV=true → data/ relative to project root (development)
 *   3. Otherwise → ~/.local/share/logitux/ (production)
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDataDir(): string {
  if (process.env.LOGITUX_DATA_DIR) {
    return process.env.LOGITUX_DATA_DIR;
  }
  if (process.env.LOGITUX_DEV === 'true') {
    return resolve(__dirname, '../../data');
  }
  return resolve(homedir(), '.local/share/logitux');
}

const DATA_DIR = resolveDataDir();
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = resolve(DATA_DIR, 'logitux.db');

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

export default db;
export { DB_PATH };
