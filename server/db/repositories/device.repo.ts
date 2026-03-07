/**
 * Device repository — CRUD for the `devices` table.
 *
 * Stores KnownDevice data with buttons/DPI info serialized as JSON
 * in the `metadata` column.
 */

import db from '../index';
import type { KnownDevice, KnownButton } from '../../types';

// ─── Row shape ───────────────────────────────────────────────────────────────

interface DeviceRow {
    id: string;
    name: string;
    displayName: string;
    model: string | null;
    image: string | null;
    metadata: string;
    createdAt: string;
    updatedAt: string;
}

interface DeviceMetadata {
    pid: number;
    maxDpi: number;
    minDpi: number;
    dpiStep: number;
    battery: number;
    buttons: KnownButton[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToDevice(row: DeviceRow): KnownDevice {
    const meta: DeviceMetadata = JSON.parse(row.metadata);
    return {
        displayName: row.displayName,
        solaarName: row.name,
        unitId: row.id,
        pid: meta.pid,
        buttons: meta.buttons,
        maxDpi: meta.maxDpi,
        minDpi: meta.minDpi,
        dpiStep: meta.dpiStep,
        svgId: row.model || 'generic',
        battery: meta.battery,
    };
}

// ─── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
    upsert: db.prepare(`
        INSERT INTO devices (id, name, displayName, model, image, metadata, updatedAt)
        VALUES (@id, @name, @displayName, @model, @image, @metadata, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            displayName = excluded.displayName,
            model = excluded.model,
            image = excluded.image,
            metadata = excluded.metadata,
            updatedAt = datetime('now')
    `),

    getAll: db.prepare('SELECT * FROM devices ORDER BY displayName'),

    getById: db.prepare('SELECT * FROM devices WHERE id = ?'),

    deleteById: db.prepare('DELETE FROM devices WHERE id = ?'),
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function upsertDevice(device: KnownDevice): void {
    const metadata: DeviceMetadata = {
        pid: device.pid,
        maxDpi: device.maxDpi,
        minDpi: device.minDpi,
        dpiStep: device.dpiStep,
        battery: device.battery,
        buttons: device.buttons,
    };

    stmts.upsert.run({
        id: device.unitId,
        name: device.solaarName,
        displayName: device.displayName,
        model: device.svgId,
        image: null,
        metadata: JSON.stringify(metadata),
    });
}

export function getAllDevices(): KnownDevice[] {
    const rows = stmts.getAll.all() as DeviceRow[];
    return rows.map(rowToDevice);
}

export function getDeviceById(id: string): KnownDevice | null {
    const row = stmts.getById.get(id) as DeviceRow | undefined;
    return row ? rowToDevice(row) : null;
}

export function deleteDevice(id: string): void {
    stmts.deleteById.run(id);
}
