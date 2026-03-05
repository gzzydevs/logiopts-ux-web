/**
 * Profile repository — CRUD for the `profiles` table.
 *
 * Stores ButtonConfig[] and windowClasses[] as JSON TEXT columns.
 */

import db from '../index';
import type { Profile, ButtonConfig } from '../../types';

// ─── Row shape ───────────────────────────────────────────────────────────────

interface ProfileRow {
    id: string;
    deviceId: string;
    name: string;
    appName: string | null;
    isDefault: number;
    dpi: number | null;
    buttons: string;        // JSON
    windowClasses: string;  // JSON
    createdAt: string;
    updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToProfile(row: ProfileRow): Profile {
    return {
        id: row.id,
        name: row.name,
        deviceName: row.deviceId,  // maps to the device's solaarName via deviceId
        dpi: row.dpi ?? undefined,
        buttons: JSON.parse(row.buttons) as ButtonConfig[],
        windowClasses: JSON.parse(row.windowClasses) as string[],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

// ─── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
    insert: db.prepare(`
        INSERT INTO profiles (id, deviceId, name, appName, isDefault, dpi, buttons, windowClasses, createdAt, updatedAt)
        VALUES (@id, @deviceId, @name, @appName, @isDefault, @dpi, @buttons, @windowClasses, @createdAt, @updatedAt)
    `),

    update: db.prepare(`
        UPDATE profiles SET
            name = @name,
            appName = @appName,
            isDefault = @isDefault,
            dpi = @dpi,
            buttons = @buttons,
            windowClasses = @windowClasses,
            updatedAt = @updatedAt
        WHERE id = @id
    `),

    getAll: db.prepare('SELECT * FROM profiles ORDER BY name'),

    getById: db.prepare('SELECT * FROM profiles WHERE id = ?'),

    getByDevice: db.prepare('SELECT * FROM profiles WHERE deviceId = ? ORDER BY name'),

    getDefault: db.prepare('SELECT * FROM profiles WHERE deviceId = ? AND isDefault = 1 LIMIT 1'),

    getByAppName: db.prepare('SELECT * FROM profiles WHERE appName = ? LIMIT 1'),

    deleteById: db.prepare('DELETE FROM profiles WHERE id = ?'),

    clearDefault: db.prepare('UPDATE profiles SET isDefault = 0 WHERE deviceId = ?'),
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function createProfile(profile: Profile): Profile {
    const now = new Date().toISOString();
    const id = profile.id || crypto.randomUUID();

    // If this is marked as default, clear existing defaults for the device
    if (profile.name.toLowerCase() === 'default') {
        stmts.clearDefault.run(profile.deviceName);
    }

    stmts.insert.run({
        id,
        deviceId: profile.deviceName,
        name: profile.name,
        appName: profile.windowClasses?.[0] ?? null,
        isDefault: profile.name.toLowerCase() === 'default' ? 1 : 0,
        dpi: profile.dpi ?? null,
        buttons: JSON.stringify(profile.buttons),
        windowClasses: JSON.stringify(profile.windowClasses ?? []),
        createdAt: profile.createdAt || now,
        updatedAt: now,
    });

    return { ...profile, id, createdAt: profile.createdAt || now, updatedAt: now };
}

export function updateProfile(id: string, changes: Partial<Profile>): Profile | null {
    const existing = getProfileById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: Profile = {
        ...existing,
        ...changes,
        id, // prevent ID change
        updatedAt: now,
    };

    stmts.update.run({
        id,
        name: updated.name,
        appName: updated.windowClasses?.[0] ?? null,
        isDefault: updated.name.toLowerCase() === 'default' ? 1 : 0,
        dpi: updated.dpi ?? null,
        buttons: JSON.stringify(updated.buttons),
        windowClasses: JSON.stringify(updated.windowClasses ?? []),
        updatedAt: now,
    });

    return updated;
}

export function getAllProfiles(): Profile[] {
    const rows = stmts.getAll.all() as ProfileRow[];
    return rows.map(rowToProfile);
}

export function getProfileById(id: string): Profile | null {
    const row = stmts.getById.get(id) as ProfileRow | undefined;
    return row ? rowToProfile(row) : null;
}

export function getProfilesByDevice(deviceId: string): Profile[] {
    const rows = stmts.getByDevice.all(deviceId) as ProfileRow[];
    return rows.map(rowToProfile);
}

export function getDefaultProfile(deviceId: string): Profile | null {
    const row = stmts.getDefault.get(deviceId) as ProfileRow | undefined;
    return row ? rowToProfile(row) : null;
}

export function getProfileByAppName(appName: string): Profile | null {
    const row = stmts.getByAppName.get(appName) as ProfileRow | undefined;
    return row ? rowToProfile(row) : null;
}

export function deleteProfile(id: string): void {
    stmts.deleteById.run(id);
}
