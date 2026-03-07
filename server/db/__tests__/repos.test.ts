/**
 * Tests for all SQLite repositories.
 *
 * Uses an in-memory database for test isolation.
 * Tests the raw SQL operations that the repos wrap.
 */

import Database from 'better-sqlite3';
import { createTestDb } from './test-helpers';

let db: InstanceType<typeof Database>;

beforeEach(() => {
    db = createTestDb();
});

afterEach(() => {
    db.close();
});

// ─── Schema validation ──────────────────────────────────────────────────────

describe('Schema', () => {
    it('should create all 5 tables', () => {
        const tables = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).all() as { name: string }[];

        const names = tables.map(t => t.name);
        expect(names).toContain('devices');
        expect(names).toContain('profiles');
        expect(names).toContain('configs');
        expect(names).toContain('scripts');
        expect(names).toContain('preferences');
    });

    it('should create indices', () => {
        const indices = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
        ).all() as { name: string }[];

        const names = indices.map(i => i.name);
        expect(names).toContain('idx_profiles_deviceId');
        expect(names).toContain('idx_profiles_appName');
        expect(names).toContain('idx_configs_profileId');
    });

    it('should enforce foreign keys', () => {
        const fkStatus = db.pragma('foreign_keys') as { foreign_keys: number }[];
        expect(fkStatus[0].foreign_keys).toBe(1);
    });
});

// ─── Devices table ───────────────────────────────────────────────────────────

describe('Devices table', () => {
    it('should insert a device', () => {
        const stmt = db.prepare(`
            INSERT INTO devices (id, name, displayName, model, metadata)
            VALUES (@id, @name, @displayName, @model, @metadata)
        `);

        stmt.run({
            id: 'unit-123',
            name: 'LIFT VERTICAL ERGONOMIC MOUSE',
            displayName: 'Logitech Lift',
            model: 'lift',
            metadata: JSON.stringify({ pid: 0x4101, maxDpi: 4000, minDpi: 400, dpiStep: 100, battery: 85, buttons: [] }),
        });

        const row = db.prepare('SELECT * FROM devices WHERE id = ?').get('unit-123') as any;
        expect(row).toBeTruthy();
        expect(row.name).toBe('LIFT VERTICAL ERGONOMIC MOUSE');
        expect(row.displayName).toBe('Logitech Lift');

        const meta = JSON.parse(row.metadata);
        expect(meta.pid).toBe(0x4101);
        expect(meta.maxDpi).toBe(4000);
    });

    it('should upsert (update on conflict)', () => {
        const stmt = db.prepare(`
            INSERT INTO devices (id, name, displayName, model, metadata)
            VALUES (@id, @name, @displayName, @model, @metadata)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                displayName = excluded.displayName,
                metadata = excluded.metadata,
                updatedAt = datetime('now')
        `);

        // First insert
        stmt.run({
            id: 'unit-123',
            name: 'LIFT',
            displayName: 'Lift',
            model: 'lift',
            metadata: JSON.stringify({ pid: 1, battery: 50 }),
        });

        // Upsert with new data
        stmt.run({
            id: 'unit-123',
            name: 'LIFT VERTICAL ERGONOMIC MOUSE',
            displayName: 'Logitech Lift',
            model: 'lift',
            metadata: JSON.stringify({ pid: 0x4101, battery: 85 }),
        });

        const rows = db.prepare('SELECT * FROM devices').all() as any[];
        expect(rows).toHaveLength(1);
        expect(rows[0].displayName).toBe('Logitech Lift');

        const meta = JSON.parse(rows[0].metadata);
        expect(meta.battery).toBe(85);
    });

    it('should delete a device', () => {
        db.prepare(`INSERT INTO devices (id, name, displayName, metadata) VALUES ('d1', 'Test', 'Test', '{}')`).run();
        db.prepare('DELETE FROM devices WHERE id = ?').run('d1');

        const row = db.prepare('SELECT * FROM devices WHERE id = ?').get('d1');
        expect(row).toBeUndefined();
    });
});

// ─── Profiles table ──────────────────────────────────────────────────────────

describe('Profiles table', () => {
    beforeEach(() => {
        // Insert a device first (FK constraint)
        db.prepare(`INSERT INTO devices (id, name, displayName, metadata) VALUES ('dev-1', 'LIFT', 'Lift', '{}')`).run();
    });

    it('should insert a profile', () => {
        db.prepare(`
            INSERT INTO profiles (id, deviceId, name, appName, isDefault, dpi, buttons, windowClasses)
            VALUES ('p1', 'dev-1', 'Default', NULL, 1, 1000, '[]', '[]')
        `).run();

        const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get('p1') as any;
        expect(row).toBeTruthy();
        expect(row.name).toBe('Default');
        expect(row.isDefault).toBe(1);
        expect(row.dpi).toBe(1000);
    });

    it('should store ButtonConfig[] as JSON', () => {
        const buttons = [
            { cid: 86, gestureMode: true, gestures: { None: { type: 'KeyPress', keys: ['Control_L', 'c'] } }, simpleAction: { type: 'None' } }
        ];

        db.prepare(`
            INSERT INTO profiles (id, deviceId, name, buttons, windowClasses)
            VALUES ('p1', 'dev-1', 'Test', @buttons, '[]')
        `).run({ buttons: JSON.stringify(buttons) });

        const row = db.prepare('SELECT buttons FROM profiles WHERE id = ?').get('p1') as any;
        const parsed = JSON.parse(row.buttons);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].cid).toBe(86);
        expect(parsed[0].gestures.None.keys).toEqual(['Control_L', 'c']);
    });

    it('should enforce device FK', () => {
        expect(() => {
            db.prepare(`
                INSERT INTO profiles (id, deviceId, name, buttons, windowClasses)
                VALUES ('p1', 'nonexistent', 'Test', '[]', '[]')
            `).run();
        }).toThrow();
    });

    it('should list profiles by deviceId', () => {
        db.prepare(`INSERT INTO profiles (id, deviceId, name, buttons, windowClasses) VALUES ('p1', 'dev-1', 'A', '[]', '[]')`).run();
        db.prepare(`INSERT INTO profiles (id, deviceId, name, buttons, windowClasses) VALUES ('p2', 'dev-1', 'B', '[]', '[]')`).run();

        const rows = db.prepare('SELECT * FROM profiles WHERE deviceId = ? ORDER BY name').all('dev-1') as any[];
        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe('A');
        expect(rows[1].name).toBe('B');
    });
});

// ─── Configs table ───────────────────────────────────────────────────────────

describe('Configs table', () => {
    beforeEach(() => {
        db.prepare(`INSERT INTO devices (id, name, displayName, metadata) VALUES ('dev-1', 'LIFT', 'Lift', '{}')`).run();
        db.prepare(`INSERT INTO profiles (id, deviceId, name, buttons, windowClasses) VALUES ('p1', 'dev-1', 'Default', '[]', '[]')`).run();
    });

    it('should insert a config', () => {
        const jsonConfig = { deviceId: 'dev-1', profile: 'default', buttons: [] };
        const yamlConfig = '%YAML 1.3\n---\n...\n';

        db.prepare(`
            INSERT INTO configs (id, profileId, jsonConfig, yamlConfig)
            VALUES ('c1', 'p1', @jsonConfig, @yamlConfig)
        `).run({
            jsonConfig: JSON.stringify(jsonConfig),
            yamlConfig,
        });

        const row = db.prepare('SELECT * FROM configs WHERE id = ?').get('c1') as any;
        expect(row).toBeTruthy();
        expect(row.profileId).toBe('p1');

        const parsed = JSON.parse(row.jsonConfig);
        expect(parsed.deviceId).toBe('dev-1');
    });

    it('should cascade delete when profile is deleted', () => {
        db.prepare(`
            INSERT INTO configs (id, profileId, jsonConfig, yamlConfig)
            VALUES ('c1', 'p1', '{}', '')
        `).run();

        // Verify config exists
        expect(db.prepare('SELECT * FROM configs WHERE id = ?').get('c1')).toBeTruthy();

        // Delete the profile
        db.prepare('DELETE FROM profiles WHERE id = ?').run('p1');

        // Config should be gone (CASCADE)
        expect(db.prepare('SELECT * FROM configs WHERE id = ?').get('c1')).toBeUndefined();
    });

    it('should mark config as applied', () => {
        db.prepare(`
            INSERT INTO configs (id, profileId, jsonConfig, yamlConfig)
            VALUES ('c1', 'p1', '{}', '')
        `).run();

        const before = db.prepare('SELECT appliedAt FROM configs WHERE id = ?').get('c1') as any;
        expect(before.appliedAt).toBeNull();

        db.prepare(`UPDATE configs SET appliedAt = datetime('now') WHERE id = ?`).run('c1');

        const after = db.prepare('SELECT appliedAt FROM configs WHERE id = ?').get('c1') as any;
        expect(after.appliedAt).toBeTruthy();
    });

    it('should store valid ProfileConfig JSON', () => {
        const jsonConfig = {
            deviceId: 'dev-1',
            profile: 'default',
            buttons: [{
                id: 'Forward Button',
                actions: {
                    click: { type: 'KeyPress', keys: ['Control_L', 'c'] },
                    up: { type: 'KeyPress', keys: ['XF86_AudioPlay'] },
                },
            }],
        };

        db.prepare(`
            INSERT INTO configs (id, profileId, jsonConfig, yamlConfig)
            VALUES ('c1', 'p1', @jsonConfig, 'yaml-content')
        `).run({ jsonConfig: JSON.stringify(jsonConfig) });

        const row = db.prepare('SELECT jsonConfig FROM configs WHERE id = ?').get('c1') as any;
        const parsed = JSON.parse(row.jsonConfig);

        expect(parsed.buttons).toHaveLength(1);
        expect(parsed.buttons[0].actions.click.keys).toEqual(['Control_L', 'c']);
    });
});

// ─── Scripts table ───────────────────────────────────────────────────────────

describe('Scripts table', () => {
    it('should insert a script', () => {
        db.prepare(`
            INSERT INTO scripts (id, name, path, content, executable)
            VALUES ('s1', 'volume.sh', '/scripts/volume.sh', '#!/bin/bash\npactl set-sink-volume @DEFAULT_SINK@ +5%', 1)
        `).run();

        const row = db.prepare('SELECT * FROM scripts WHERE id = ?').get('s1') as any;
        expect(row).toBeTruthy();
        expect(row.name).toBe('volume.sh');
        expect(row.executable).toBe(1);
        expect(row.content).toContain('pactl');
    });

    it('should enforce unique script names', () => {
        db.prepare(`INSERT INTO scripts (id, name, path, content) VALUES ('s1', 'test.sh', '/p', 'echo')`).run();

        expect(() => {
            db.prepare(`INSERT INTO scripts (id, name, path, content) VALUES ('s2', 'test.sh', '/p2', 'echo')`).run();
        }).toThrow();
    });

    it('should update a script', () => {
        db.prepare(`INSERT INTO scripts (id, name, path, content) VALUES ('s1', 'test.sh', '/p', 'echo hello')`).run();

        db.prepare(`UPDATE scripts SET content = 'echo world', updatedAt = datetime('now') WHERE id = ?`).run('s1');

        const row = db.prepare('SELECT content FROM scripts WHERE id = ?').get('s1') as any;
        expect(row.content).toBe('echo world');
    });

    it('should delete a script', () => {
        db.prepare(`INSERT INTO scripts (id, name, path, content) VALUES ('s1', 'test.sh', '/p', 'echo')`).run();

        db.prepare('DELETE FROM scripts WHERE id = ?').run('s1');

        expect(db.prepare('SELECT * FROM scripts WHERE id = ?').get('s1')).toBeUndefined();
    });
});

// ─── Cross-table integrity ──────────────────────────────────────────────────

describe('Cross-table integrity', () => {
    it('should support the full chain: device → profile → config', () => {
        // 1. Insert device
        db.prepare(`INSERT INTO devices (id, name, displayName, metadata) VALUES ('d1', 'LIFT', 'Lift', '{"pid":16641}')`).run();

        // 2. Insert profile linked to device
        const buttons = [{ cid: 86, gestureMode: false, gestures: {}, simpleAction: { type: 'KeyPress', keys: ['Control_L', 'c'] } }];
        db.prepare(`
            INSERT INTO profiles (id, deviceId, name, buttons, windowClasses)
            VALUES ('p1', 'd1', 'Default', @buttons, '[]')
        `).run({ buttons: JSON.stringify(buttons) });

        // 3. Insert config linked to profile
        const jsonConfig = { deviceId: 'd1', profile: 'default', buttons: [{ id: 'CID-86', actions: { click: { type: 'KeyPress', keys: ['Control_L', 'c'] } } }] };
        db.prepare(`
            INSERT INTO configs (id, profileId, jsonConfig, yamlConfig)
            VALUES ('c1', 'p1', @jsonConfig, '%YAML 1.3\n---\ntest...')
        `).run({ jsonConfig: JSON.stringify(jsonConfig) });

        // Verify full chain
        const device = db.prepare('SELECT * FROM devices WHERE id = ?').get('d1');
        const profile = db.prepare('SELECT * FROM profiles WHERE deviceId = ?').get('d1') as any;
        const config = db.prepare('SELECT * FROM configs WHERE profileId = ?').get(profile.id) as any;

        expect(device).toBeTruthy();
        expect(profile.name).toBe('Default');
        expect(JSON.parse(config.jsonConfig).buttons[0].id).toBe('CID-86');
    });

    it('should cascade: deleting a device does NOT cascade to profiles (requires explicit delete)', () => {
        db.prepare(`INSERT INTO devices (id, name, displayName, metadata) VALUES ('d1', 'LIFT', 'Lift', '{}')`).run();
        db.prepare(`INSERT INTO profiles (id, deviceId, name, buttons, windowClasses) VALUES ('p1', 'd1', 'Default', '[]', '[]')`).run();

        // Deleting device SHOULD fail due to FK constraint (no CASCADE set on profiles.deviceId)
        expect(() => {
            db.prepare('DELETE FROM devices WHERE id = ?').run('d1');
        }).toThrow();
    });

    it('should cascade: deleting a profile cascades to configs', () => {
        db.prepare(`INSERT INTO devices (id, name, displayName, metadata) VALUES ('d1', 'LIFT', 'Lift', '{}')`).run();
        db.prepare(`INSERT INTO profiles (id, deviceId, name, buttons, windowClasses) VALUES ('p1', 'd1', 'Default', '[]', '[]')`).run();
        db.prepare(`INSERT INTO configs (id, profileId, jsonConfig, yamlConfig) VALUES ('c1', 'p1', '{}', '')`).run();
        db.prepare(`INSERT INTO configs (id, profileId, jsonConfig, yamlConfig) VALUES ('c2', 'p1', '{}', '')`).run();

        db.prepare('DELETE FROM profiles WHERE id = ?').run('p1');

        const configs = db.prepare('SELECT * FROM configs WHERE profileId = ?').all('p1');
        expect(configs).toHaveLength(0);
    });
});
