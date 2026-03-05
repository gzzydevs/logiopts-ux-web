/**
 * In-memory state store.
 *
 * Maintains cached JSON/YAML for active profiles, avoids
 * redundant parser calls, and enables rollback if Solaar apply fails.
 */

import type { KnownDevice, Profile, ButtonConfig } from '../types';
import type { ProfileConfig } from '../solaar/schema';
import { jsonToSolaarYaml } from '../solaar/index';
import { buttonConfigsToProfileConfig } from './bridge';
import { getAllDevices } from '../db/repositories/device.repo';
import { getAllProfiles as dbGetAllProfiles } from '../db/repositories/profile.repo';
import { getAllConfigs, saveConfig as dbSaveConfig } from '../db/repositories/config.repo';
import { getAllScripts } from '../db/repositories/script.repo';
import type { Config } from '../db/repositories/config.repo';
import type { Script } from '../db/repositories/script.repo';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConfigCacheEntry {
    json: ProfileConfig;
    yaml: string;
    dirty: boolean;
}

interface AppliedSnapshot {
    profileId: string;
    json: ProfileConfig;
    yaml: string;
}

export interface BootstrapData {
    devices: KnownDevice[];
    profiles: Profile[];
    configs: { profileId: string; yamlConfig: string; appliedAt: string | null }[];
    scripts: Script[];
}

interface MemoryState {
    currentDevice: KnownDevice | null;
    activeProfileId: string | null;
    configCache: Map<string, ConfigCacheEntry>;
    lastApplied: AppliedSnapshot | null;
}

// ─── Singleton state ─────────────────────────────────────────────────────────

const state: MemoryState = {
    currentDevice: null,
    activeProfileId: null,
    configCache: new Map(),
    lastApplied: null,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get the full in-memory state (read-only snapshot) */
export function getState(): Readonly<MemoryState> {
    return state;
}

/** Set the currently active device */
export function setCurrentDevice(device: KnownDevice): void {
    state.currentDevice = device;
}

/** Get the current device */
export function getCurrentDevice(): KnownDevice | null {
    return state.currentDevice;
}

/** Set the active profile ID */
export function setActiveProfile(profileId: string): void {
    state.activeProfileId = profileId;
}

/** Get active profile ID */
export function getActiveProfileId(): string | null {
    return state.activeProfileId;
}

/**
 * Update the config for a profile in the cache.
 * Regenerates YAML from the JSON config using the parser.
 * Marks the entry as dirty (not yet persisted to DB).
 */
export function updateConfig(profileId: string, config: ProfileConfig): ConfigCacheEntry {
    const yaml = jsonToSolaarYaml(config);
    const entry: ConfigCacheEntry = { json: config, yaml, dirty: true };
    state.configCache.set(profileId, entry);
    return entry;
}

/**
 * Update config from UI format (ButtonConfig[]).
 * Converts to parser format first, then caches.
 */
export function updateConfigFromUI(
    profileId: string,
    buttons: ButtonConfig[],
    deviceId: string,
    profileName: string,
): ConfigCacheEntry {
    const parserConfig = buttonConfigsToProfileConfig(buttons, deviceId, profileName);
    return updateConfig(profileId, parserConfig);
}

/**
 * Get cached config for a profile.
 * Returns null if not in cache.
 */
export function getCachedConfig(profileId: string): ConfigCacheEntry | null {
    return state.configCache.get(profileId) ?? null;
}

/**
 * Persist the cached config for a profile to the database.
 * Clears the dirty flag.
 */
export function persistConfig(profileId: string): Config | null {
    const entry = state.configCache.get(profileId);
    if (!entry) return null;

    const saved = dbSaveConfig(profileId, entry.json);
    entry.dirty = false;
    return saved;
}

/**
 * Record a snapshot before applying to Solaar.
 * Call this BEFORE running apply-solaar.sh so we can rollback on failure.
 */
export function snapshotForRollback(profileId: string): void {
    const entry = state.configCache.get(profileId);
    if (entry) {
        state.lastApplied = {
            profileId,
            json: entry.json,
            yaml: entry.yaml,
        };
    }
}

/**
 * Rollback to the last applied config.
 * Returns the snapshot if available, null otherwise.
 */
export function rollback(): AppliedSnapshot | null {
    const snapshot = state.lastApplied;
    if (snapshot) {
        // Restore the cache entry
        state.configCache.set(snapshot.profileId, {
            json: snapshot.json,
            yaml: snapshot.yaml,
            dirty: false,
        });
    }
    return snapshot;
}

/**
 * Invalidate (remove) a profile's cache entry.
 * Forces re-generation on next access.
 */
export function invalidateProfile(profileId: string): void {
    state.configCache.delete(profileId);
}

/**
 * Bootstrap: load everything from DB for initial UI render.
 */
export function bootstrap(): BootstrapData {
    const devices = getAllDevices();
    const profiles = dbGetAllProfiles();
    const configs = getAllConfigs().map(c => ({
        profileId: c.profileId,
        yamlConfig: c.yamlConfig,
        appliedAt: c.appliedAt,
    }));
    const scripts = getAllScripts();

    // Warm up the config cache
    for (const config of getAllConfigs()) {
        if (!state.configCache.has(config.profileId)) {
            state.configCache.set(config.profileId, {
                json: config.jsonConfig,
                yaml: config.yamlConfig,
                dirty: false,
            });
        }
    }

    return { devices, profiles, configs, scripts };
}

/**
 * Clear all in-memory state (useful for tests).
 */
export function clearState(): void {
    state.currentDevice = null;
    state.activeProfileId = null;
    state.configCache.clear();
    state.lastApplied = null;
}
