/**
 * Tests for script.repo — uses Jest module mock to inject in-memory DB.
 *
 * Note: disk sync (writeFileSync/chmodSync) operations are mocked
 * to avoid writing to the real filesystem.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve(__dirname, '../schema.sql'), 'utf-8');
const testDb = new Database(':memory:');
testDb.pragma('journal_mode = WAL');
testDb.pragma('foreign_keys = ON');
testDb.exec(schema);

jest.mock('../index', () => testDb);

// Mock fs operations to avoid writing to disk during tests
jest.mock('node:fs', () => {
    const actual = jest.requireActual('node:fs');
    return {
        ...actual,
        writeFileSync: jest.fn(),
        unlinkSync: jest.fn(),
        chmodSync: jest.fn(),
        existsSync: actual.existsSync,
        readFileSync: actual.readFileSync,
        readdirSync: jest.fn(() => []),
    };
});

import {
    createScript,
    updateScript,
    getAllScripts,
    getScriptById,
    getScriptByName,
    deleteScript,
} from '../repositories/script.repo';

afterAll(() => testDb.close());

beforeEach(() => {
    testDb.exec('DELETE FROM scripts;');
});

describe('script.repo', () => {
    it('should create a script', () => {
        const result = createScript({ name: 'test.sh', content: '#!/bin/bash\necho hello' });

        expect(result.id).toBeTruthy();
        expect(result.name).toBe('test.sh');
        expect(result.content).toBe('#!/bin/bash\necho hello');
        expect(result.executable).toBe(true);
    });

    it('should create a non-executable script', () => {
        const result = createScript({ name: 'data.txt', content: 'some data', executable: false });

        expect(result.executable).toBe(false);
    });

    it('should reject dangerous commands', () => {
        expect(() => {
            createScript({ name: 'evil.sh', content: 'rm -rf /' });
        }).toThrow(/dangerous/i);
    });

    it('should reject fork bombs', () => {
        expect(() => {
            createScript({ name: 'bomb.sh', content: ':(){ :|:& };:' });
        }).toThrow(/dangerous/i);
    });

    it('should allow safe scripts', () => {
        const result = createScript({
            name: 'safe.sh',
            content: '#!/bin/bash\npactl set-sink-volume @DEFAULT_SINK@ +5%',
        });
        expect(result.name).toBe('safe.sh');
    });

    it('should get all scripts sorted by name', () => {
        createScript({ name: 'b-script.sh', content: 'echo b' });
        createScript({ name: 'a-script.sh', content: 'echo a' });

        const all = getAllScripts();
        expect(all).toHaveLength(2);
        expect(all[0].name).toBe('a-script.sh');
        expect(all[1].name).toBe('b-script.sh');
    });

    it('should get script by id', () => {
        const created = createScript({ name: 'test.sh', content: 'echo test' });

        const result = getScriptById(created.id);
        expect(result).not.toBeNull();
        expect(result!.name).toBe('test.sh');
    });

    it('should get script by name', () => {
        createScript({ name: 'volume.sh', content: 'echo vol' });

        const result = getScriptByName('volume.sh');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('volume.sh');
    });

    it('should return null for non-existent script', () => {
        expect(getScriptById('nonexistent')).toBeNull();
        expect(getScriptByName('nonexistent.sh')).toBeNull();
    });

    it('should update script content', () => {
        const created = createScript({ name: 'test.sh', content: 'echo old' });

        const updated = updateScript(created.id, { content: 'echo new' });
        expect(updated).not.toBeNull();
        expect(updated!.content).toBe('echo new');

        // Verify persisted
        const fromDb = getScriptById(created.id)!;
        expect(fromDb.content).toBe('echo new');
    });

    it('should update script name', () => {
        const created = createScript({ name: 'old.sh', content: 'echo test' });

        const updated = updateScript(created.id, { name: 'new.sh' });
        expect(updated!.name).toBe('new.sh');
    });

    it('should reject dangerous content on update', () => {
        const created = createScript({ name: 'test.sh', content: 'echo safe' });

        expect(() => {
            updateScript(created.id, { content: 'rm -rf /' });
        }).toThrow(/dangerous/i);
    });

    it('should return null when updating non-existent script', () => {
        expect(updateScript('nonexistent', { content: 'foo' })).toBeNull();
    });

    it('should delete a script', () => {
        const created = createScript({ name: 'test.sh', content: 'echo test' });
        deleteScript(created.id);
        expect(getScriptById(created.id)).toBeNull();
    });

    it('should enforce unique script names', () => {
        createScript({ name: 'unique.sh', content: 'echo 1' });

        expect(() => {
            createScript({ name: 'unique.sh', content: 'echo 2' });
        }).toThrow();
    });
});
