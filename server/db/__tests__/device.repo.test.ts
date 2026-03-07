/**
 * Tests for device.repo — uses Jest module mock to inject in-memory DB.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Create in-memory DB before importing the repo
const schema = readFileSync(resolve(__dirname, '../schema.sql'), 'utf-8');
const testDb = new Database(':memory:');
testDb.pragma('journal_mode = WAL');
testDb.pragma('foreign_keys = ON');
testDb.exec(schema);

// Mock the db/index module to return our test DB
jest.mock('../index', () => testDb);

import { upsertDevice, getAllDevices, getDeviceById, deleteDevice, updateDeviceLayout } from '../repositories/device.repo';
import type { KnownDevice } from '../../types';

function makeDevice(overrides: Partial<KnownDevice> = {}): KnownDevice {
    return {
        displayName: 'Logitech Lift',
        solaarName: 'LIFT VERTICAL ERGONOMIC MOUSE',
        unitId: 'unit-123',
        pid: 0x4101,
        buttons: [
            { cid: 86, name: 'Forward', solaarName: 'Forward Button', divertable: true, rawXy: true, reprogrammable: true, position: 'forward' },
            { cid: 253, name: 'DPI Switch', solaarName: 'DPI Switch', divertable: true, rawXy: false, reprogrammable: true, position: 'dpiSwitch' },
        ],
        maxDpi: 4000,
        minDpi: 400,
        dpiStep: 100,
        svgId: 'lift',
        battery: 85,
        ...overrides,
    };
}

afterAll(() => testDb.close());

beforeEach(() => {
    testDb.exec('DELETE FROM configs; DELETE FROM profiles; DELETE FROM devices;');
});

describe('device.repo', () => {
    it('should insert a new device', () => {
        const device = makeDevice();
        upsertDevice(device);

        const result = getDeviceById('unit-123');
        expect(result).not.toBeNull();
        expect(result!.displayName).toBe('Logitech Lift');
        expect(result!.solaarName).toBe('LIFT VERTICAL ERGONOMIC MOUSE');
        expect(result!.unitId).toBe('unit-123');
        expect(result!.pid).toBe(0x4101);
        expect(result!.maxDpi).toBe(4000);
        expect(result!.battery).toBe(85);
        expect(result!.svgId).toBe('lift');
    });

    it('should preserve buttons array through serialization', () => {
        upsertDevice(makeDevice());

        const result = getDeviceById('unit-123')!;
        expect(result.buttons).toHaveLength(2);
        expect(result.buttons[0].cid).toBe(86);
        expect(result.buttons[0].solaarName).toBe('Forward Button');
        expect(result.buttons[1].cid).toBe(253);
    });

    it('should update on conflict (upsert)', () => {
        upsertDevice(makeDevice({ battery: 50 }));
        upsertDevice(makeDevice({ battery: 95 }));

        const all = getAllDevices();
        expect(all).toHaveLength(1);
        expect(all[0].battery).toBe(95);
    });

    it('should return all devices sorted by displayName', () => {
        upsertDevice(makeDevice({ unitId: 'b', displayName: 'MX Master', solaarName: 'MX' }));
        upsertDevice(makeDevice({ unitId: 'a', displayName: 'Lift', solaarName: 'LIFT' }));

        const all = getAllDevices();
        expect(all).toHaveLength(2);
        expect(all[0].displayName).toBe('Lift');
        expect(all[1].displayName).toBe('MX Master');
    });

    it('should return null for non-existent device', () => {
        expect(getDeviceById('nonexistent')).toBeNull();
    });

    it('should delete a device', () => {
        upsertDevice(makeDevice());
        deleteDevice('unit-123');
        expect(getDeviceById('unit-123')).toBeNull();
    });

    it('should update device button layout', () => {
        upsertDevice(makeDevice());

        const layout: Record<number, { x: number; y: number }> = {
            86: { x: 20.5, y: 43.0 },
            253: { x: 50.0, y: 50.0 },
        };
        updateDeviceLayout('unit-123', layout);

        const result = getDeviceById('unit-123')!;
        expect(result.buttons[0].cid).toBe(86);
        expect(result.buttons[0].layoutX).toBe(20.5);
        expect(result.buttons[0].layoutY).toBe(43.0);
        expect(result.buttons[1].cid).toBe(253);
        expect(result.buttons[1].layoutX).toBe(50.0);
        expect(result.buttons[1].layoutY).toBe(50.0);
    });

    it('should preserve button layout on upsert', () => {
        upsertDevice(makeDevice());
        updateDeviceLayout('unit-123', { 86: { x: 15, y: 30 } });

        // Upsert again (simulating re-detection)
        upsertDevice(makeDevice({ battery: 99 }));

        const result = getDeviceById('unit-123')!;
        expect(result.battery).toBe(99);
        // Layout should be preserved
        expect(result.buttons[0].layoutX).toBe(15);
        expect(result.buttons[0].layoutY).toBe(30);
    });

    it('should not fail when updating layout for non-existent device', () => {
        expect(() => {
            updateDeviceLayout('nonexistent', { 86: { x: 10, y: 20 } });
        }).not.toThrow();
    });

    it('should return buttons without layoutX/Y when no layout saved', () => {
        upsertDevice(makeDevice());
        const result = getDeviceById('unit-123')!;
        expect(result.buttons[0].layoutX).toBeUndefined();
        expect(result.buttons[0].layoutY).toBeUndefined();
    });
});
