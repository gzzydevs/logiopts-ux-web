/**
 * Device repository — CRUD for the `devices` table.
 *
 * Stores KnownDevice data with buttons/DPI info serialized as JSON
 * in the `metadata` column.
 */

import db from '../index.js';
import type { KnownDevice, KnownButton } from '../../types.js';

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
    /** Per-button layout positions set by the layout editor */
    buttonLayout?: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToDevice(row: DeviceRow): KnownDevice {
    const meta: DeviceMetadata = JSON.parse(row.metadata);
    // Apply saved layout positions to buttons
    const buttons = meta.buttons.map(btn => {
        if (meta.buttonLayout && meta.buttonLayout[btn.cid]) {
            const pos = meta.buttonLayout[btn.cid];
            return {
                ...btn,
                layoutX: pos.x,
                layoutY: pos.y,
                ...(pos.labelSide ? { labelSide: pos.labelSide } : {}),
            };
        }
        return btn;
    });
    return {
        displayName: row.displayName,
        solaarName: row.name,
        unitId: row.id,
        pid: meta.pid,
        buttons,
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
    // Preserve existing buttonLayout if present in DB
    const existing = stmts.getById.get(device.unitId) as DeviceRow | undefined;
    let existingLayout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }> | undefined;
    if (existing) {
        const existingMeta: DeviceMetadata = JSON.parse(existing.metadata);
        existingLayout = existingMeta.buttonLayout;
    }

    const metadata: DeviceMetadata = {
        pid: device.pid,
        maxDpi: device.maxDpi,
        minDpi: device.minDpi,
        dpiStep: device.dpiStep,
        battery: device.battery,
        buttons: device.buttons,
        ...(existingLayout ? { buttonLayout: existingLayout } : {}),
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

export function updateDeviceLayout(
    deviceId: string,
    layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>,
): void {
    const row = stmts.getById.get(deviceId) as DeviceRow | undefined;
    if (!row) return;

    const meta: DeviceMetadata = JSON.parse(row.metadata);
    meta.buttonLayout = layout;

    stmts.upsert.run({
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        model: row.model,
        image: row.image,
        metadata: JSON.stringify(meta),
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
