/**
 * Tests for preferences.repo — uses Jest module mock to inject in-memory DB.
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

import {
    getPreference,
    setPreference,
    getAllPreferences,
    deletePreference,
} from '../repositories/preferences.repo';

describe('preferences.repo', () => {
    beforeEach(() => {
        testDb.exec('DELETE FROM preferences');
    });

    it('should return null for non-existent key', () => {
        expect(getPreference('nonexistent')).toBeNull();
    });

    it('should set and get a preference', () => {
        setPreference('windowWatcherEnabled', 'true');
        expect(getPreference('windowWatcherEnabled')).toBe('true');
    });

    it('should overwrite existing preference', () => {
        setPreference('locale', 'en');
        setPreference('locale', 'es');
        expect(getPreference('locale')).toBe('es');
    });

    it('should get all preferences', () => {
        setPreference('windowWatcherEnabled', 'false');
        setPreference('lastActiveProfileId', '123');
        setPreference('locale', 'en');

        const all = getAllPreferences();
        expect(all).toEqual({
            windowWatcherEnabled: 'false',
            lastActiveProfileId: '123',
            locale: 'en',
        });
    });

    it('should return empty object when no preferences', () => {
        expect(getAllPreferences()).toEqual({});
    });

    it('should delete a preference', () => {
        setPreference('locale', 'en');
        expect(getPreference('locale')).toBe('en');

        deletePreference('locale');
        expect(getPreference('locale')).toBeNull();
    });

    it('should not fail when deleting non-existent key', () => {
        expect(() => deletePreference('nonexistent')).not.toThrow();
    });

    it('should handle empty string values', () => {
        setPreference('test', '');
        expect(getPreference('test')).toBe('');
    });

    it('should handle JSON string values', () => {
        const jsonValue = JSON.stringify({ nested: true, count: 42 });
        setPreference('complexKey', jsonValue);
        expect(getPreference('complexKey')).toBe(jsonValue);
        expect(JSON.parse(getPreference('complexKey')!)).toEqual({ nested: true, count: 42 });
    });
});
