/**
 * Test helper: creates an in-memory SQLite database with the schema applied.
 *
 * Used by repo tests to avoid writing to disk.
 * Since the repos import the singleton `db` from '../index', we use
 * Jest's module mocking to intercept the import.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(__dirname, '../schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

/**
 * Create a fresh in-memory database with schema applied.
 * Each test file gets its own isolated DB instance.
 */
export function createTestDb(): InstanceType<typeof Database> {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(schema);
    return db;
}
