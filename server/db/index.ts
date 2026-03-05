/**
 * SQLite database initialization and singleton.
 *
 * Uses better-sqlite3 for synchronous, fast access.
 * DB file lives at data/logitux.db (configurable via DB_PATH env var).
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || resolve(__dirname, '../../data/logitux.db');

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
