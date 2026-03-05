/**
 * Tests for profile.repo — uses Jest module mock to inject in-memory DB.
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
    createProfile,
    updateProfile,
    getAllProfiles,
    getProfileById,
    getProfilesByDevice,
    getDefaultProfile,
    getProfileByAppName,
    deleteProfile,
} from '../repositories/profile.repo';
import type { Profile } from '../../types';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
    return {
        id: 'p-1',
        name: 'Default',
        deviceName: 'dev-1',
        dpi: 1000,
        buttons: [
            { cid: 86, gestureMode: false, gestures: { None: { type: 'None' }, Up: { type: 'None' }, Down: { type: 'None' }, Left: { type: 'None' }, Right: { type: 'None' } }, simpleAction: { type: 'KeyPress', keys: ['Control_L', 'c'] } },
        ],
        windowClasses: ['firefox', 'chromium'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

afterAll(() => testDb.close());

beforeEach(() => {
    testDb.exec('DELETE FROM configs; DELETE FROM profiles; DELETE FROM devices;');
    // Insert device for FK
    testDb.prepare(`INSERT INTO devices (id, name, displayName, metadata) VALUES ('dev-1', 'LIFT', 'Lift', '{}')`).run();
});

describe('profile.repo', () => {
    it('should create a profile and return it with timestamps', () => {
        const result = createProfile(makeProfile());

        expect(result.id).toBe('p-1');
        expect(result.name).toBe('Default');
        expect(result.deviceName).toBe('dev-1');
        expect(result.updatedAt).toBeTruthy();
    });

    it('should auto-generate ID if missing', () => {
        const result = createProfile(makeProfile({ id: '' }));

        expect(result.id).toBeTruthy();
        expect(result.id.length).toBeGreaterThan(10); // UUID
    });

    it('should serialize and deserialize buttons as JSON', () => {
        createProfile(makeProfile());

        const result = getProfileById('p-1');
        expect(result).not.toBeNull();
        expect(result!.buttons).toHaveLength(1);
        expect(result!.buttons[0].cid).toBe(86);
        expect(result!.buttons[0].simpleAction).toEqual({ type: 'KeyPress', keys: ['Control_L', 'c'] });
    });

    it('should serialize and deserialize windowClasses', () => {
        createProfile(makeProfile());

        const result = getProfileById('p-1')!;
        expect(result.windowClasses).toEqual(['firefox', 'chromium']);
    });

    it('should get all profiles sorted by name', () => {
        createProfile(makeProfile({ id: 'p-2', name: 'Zulu' }));
        createProfile(makeProfile({ id: 'p-1', name: 'Alpha' }));

        const all = getAllProfiles();
        expect(all).toHaveLength(2);
        expect(all[0].name).toBe('Alpha');
        expect(all[1].name).toBe('Zulu');
    });

    it('should get profiles by device', () => {
        createProfile(makeProfile({ id: 'p-1', name: 'A' }));
        createProfile(makeProfile({ id: 'p-2', name: 'B' }));

        const byDevice = getProfilesByDevice('dev-1');
        expect(byDevice).toHaveLength(2);
    });

    it('should get default profile', () => {
        createProfile(makeProfile({ id: 'p-default', name: 'default' }));
        createProfile(makeProfile({ id: 'p-other', name: 'Gaming' }));

        const def = getDefaultProfile('dev-1');
        expect(def).not.toBeNull();
        expect(def!.id).toBe('p-default');
    });

    it('should get profile by appName', () => {
        createProfile(makeProfile({ id: 'p-1', windowClasses: ['firefox'] }));

        const result = getProfileByAppName('firefox');
        expect(result).not.toBeNull();
        expect(result!.id).toBe('p-1');
    });

    it('should update a profile', () => {
        createProfile(makeProfile());

        const updated = updateProfile('p-1', { name: 'Gaming', dpi: 2000 });
        expect(updated).not.toBeNull();
        expect(updated!.name).toBe('Gaming');
        expect(updated!.dpi).toBe(2000);

        // Verify persisted
        const fromDb = getProfileById('p-1')!;
        expect(fromDb.name).toBe('Gaming');
        expect(fromDb.dpi).toBe(2000);
    });

    it('should update buttons in a profile', () => {
        createProfile(makeProfile());

        const newButtons = [
            { cid: 253, gestureMode: false, gestures: { None: { type: 'None' }, Up: { type: 'None' }, Down: { type: 'None' }, Left: { type: 'None' }, Right: { type: 'None' } }, simpleAction: { type: 'MouseClick', button: 'middle', count: 'click' } },
        ];
        updateProfile('p-1', { buttons: newButtons as any });

        const fromDb = getProfileById('p-1')!;
        expect(fromDb.buttons).toHaveLength(1);
        expect(fromDb.buttons[0].cid).toBe(253);
    });

    it('should return null when updating non-existent profile', () => {
        expect(updateProfile('nonexistent', { name: 'foo' })).toBeNull();
    });

    it('should delete a profile', () => {
        createProfile(makeProfile());
        deleteProfile('p-1');
        expect(getProfileById('p-1')).toBeNull();
    });

    it('should return null for non-existent profile', () => {
        expect(getProfileById('nonexistent')).toBeNull();
    });
});
