import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import type {
    KnownDevice,
    Profile,
    ButtonConfig,
    SolaarAction,
    GestureDirection,
    Script,
    SystemAction,
    Toast,
    SolaarConfig,
} from '../types';
import {
    fetchBootstrap,
    fetchDevice,
    fetchSystemActions,
    saveConfigToDB,
    applyConfig as apiApplyConfig,
    saveProfile as apiSaveProfile,
    deleteProfile as apiDeleteProfile,
    updateProfile as apiUpdateProfile,
} from '../hooks/useApi';

// ─── App Status ──────────────────────────────────────────────────────────────

type AppStatus = 'loading' | 'connected' | 'error' | 'no-device';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type ApplyStatus = 'idle' | 'applying' | 'applied' | 'error';

// ─── Context Type ────────────────────────────────────────────────────────────

interface AppContextType {
    // State
    appStatus: AppStatus;
    device: KnownDevice | null;
    devices: KnownDevice[];
    activeDeviceId: string | null;
    profiles: Profile[];
    activeProfileId: string | null;
    appliedProfileId: string | null;
    buttons: ButtonConfig[];
    scripts: Script[];
    systemActions: SystemAction[];
    saveStatus: SaveStatus;
    applyStatus: ApplyStatus;
    toasts: Toast[];
    windowWatcherActive: boolean;
    selectedCid: number | null;
    dirty: boolean;
    isLayoutEditMode: boolean;

    // Actions
    bootstrap: () => Promise<void>;
    detectDevice: () => Promise<void>;
    selectDevice: (id: string) => void;
    selectProfile: (id: string) => void;
    setSelectedCid: (cid: number | null) => void;
    updateButton: (cid: number, changes: Partial<ButtonConfig>) => void;
    saveConfig: () => Promise<void>;
    applyCurrentConfig: () => Promise<void>;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    setWindowWatcherActive: (active: boolean) => void;
    setLayoutEditMode: (active: boolean) => void;
    createNewProfile: (name: string, windowClasses?: string[], cloneFromProfileId?: string) => Promise<void>;
    deleteCurrentProfile: () => Promise<void>;
    updateProfileMeta: (id: string, changes: Partial<Profile>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Default button config factory ───────────────────────────────────────────

function makeDefaultButtonConfig(cid: number): ButtonConfig {
    const noneAction: SolaarAction = { type: 'None' };
    return {
        cid,
        gestureMode: false,
        gestures: {
            None: noneAction,
            Up: noneAction,
            Down: noneAction,
            Left: noneAction,
            Right: noneAction,
        } as Record<GestureDirection, SolaarAction>,
        simpleAction: noneAction,
    };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [appStatus, setAppStatus] = useState<AppStatus>('loading');
    const [device, setDevice] = useState<KnownDevice | null>(null);
    const [devices, setDevices] = useState<KnownDevice[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [buttons, setButtons] = useState<ButtonConfig[]>([]);
    const [scripts, setScripts] = useState<Script[]>([]);
    const [systemActions, setSystemActions] = useState<SystemAction[]>([]);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [windowWatcherActive, setWindowWatcherActive] = useState(false);
    const [selectedCid, setSelectedCid] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const [isLayoutEditMode, setLayoutEditMode] = useState(false);
    const [appliedProfileId, setAppliedProfileId] = useState<string | null>(null);
    const toastIdRef = useRef(0);
    // allProfilesRef holds ALL profiles across all devices for SSE watcher lookups
    const allProfilesRef = useRef<Profile[]>([]);
    // profilesRef mirrors the filtered profiles list (current device only)
    const profilesRef = useRef<Profile[]>([]);
    profilesRef.current = profiles;
    // devicesRef for stale-closure-safe access in selectDevice callback
    const devicesRef = useRef<KnownDevice[]>([]);
    devicesRef.current = devices;

    // ─── Toast management ──────────────────────────────────────────────────────

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${++toastIdRef.current}`;
        const newToast: Toast = { ...toast, id };
        setToasts(prev => [...prev, newToast]);

        // Auto-dismiss
        const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 3000);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // ─── Profile selection ─────────────────────────────────────────────────────

    const selectProfile = useCallback((id: string) => {
        setActiveProfileId(id);
        const profile = profiles.find(p => p.id === id);
        if (profile) {
            setButtons([...profile.buttons]);
        } else {
            setButtons([]);
        }
        setDirty(false);
        setSelectedCid(null);
        setSaveStatus('idle');
        setApplyStatus('idle');
    }, [profiles]);

    // ─── Bootstrap ─────────────────────────────────────────────────────────────

    const bootstrap = useCallback(async () => {
        setAppStatus('loading');
        try {
            const data = await fetchBootstrap();

            // Decorate devices with connected status from the response
            const allDevices = data.devices.map(d => ({
                ...d,
                connected: (data.connectedDeviceIds ?? []).includes(d.unitId),
            }));
            setDevices(allDevices);

            // Store all profiles across devices for SSE lookups
            allProfilesRef.current = data.profiles;

            // Determine active device: prefer last saved, else first connected, else first available
            const lastDeviceId = data.preferences?.lastActiveDeviceId;
            const activeDevice =
                (lastDeviceId ? allDevices.find(d => d.unitId === lastDeviceId) : null)
                ?? allDevices.find(d => d.connected)
                ?? allDevices[0]
                ?? null;

            setDevice(activeDevice);
            setActiveDeviceId(activeDevice?.unitId ?? null);

            // Filter profiles to the active device
            const deviceProfiles = activeDevice
                ? data.profiles.filter(p => p.deviceName === activeDevice.unitId)
                : data.profiles;
            setProfiles(deviceProfiles);

            // Set scripts
            setScripts(data.scripts);

            // Load system actions
            try {
                const actions = await fetchSystemActions();
                setSystemActions(actions);
            } catch {
                // Non-critical, continue without system actions
            }

            // Select profile: restore last active, or use applied, or default, or first
            if (deviceProfiles.length > 0) {
                const lastSelectedId = data.preferences?.lastActiveProfileId;
                const initialProfile =
                    (lastSelectedId ? deviceProfiles.find(p => p.id === lastSelectedId) : null)
                    ?? (data.activeProfileId ? deviceProfiles.find(p => p.id === data.activeProfileId) : null)
                    ?? deviceProfiles[0];
                setActiveProfileId(initialProfile.id);
                setButtons([...initialProfile.buttons]);
                setAppliedProfileId(data.activeProfileId || initialProfile.id);
            }

            // Restore window watcher state from preferences
            if (data.preferences?.windowWatcherEnabled === 'true') {
                setWindowWatcherActive(true);
            }

            setAppStatus(activeDevice ? 'connected' : 'no-device');
        } catch (err) {
            console.error('[Bootstrap] Failed:', err);
            setAppStatus('error');
            addToast({
                type: 'error',
                message: `Bootstrap failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }, [addToast]);

    // ─── Device detection ──────────────────────────────────────────────────────

    const detectDevice = useCallback(async () => {
        try {
            addToast({ type: 'info', message: 'Detecting device via Solaar...' });
            const resp = await fetchDevice();
            addToast({ type: 'success', message: `Detected: ${resp.device.displayName}` });

            // Re-bootstrap to get updated data including connected status
            const data = await fetchBootstrap();
            const allDevices = data.devices.map(d => ({
                ...d,
                connected: (data.connectedDeviceIds ?? []).includes(d.unitId),
            }));
            setDevices(allDevices);
            allProfilesRef.current = data.profiles;

            // Use the newly detected device as active
            const newDevice = allDevices.find(d => d.unitId === resp.device.unitId) ?? resp.device;
            setDevice(newDevice);
            setActiveDeviceId(newDevice.unitId);
            setAppStatus('connected');

            const deviceProfiles = data.profiles.filter(p => p.deviceName === newDevice.unitId);
            setProfiles(deviceProfiles);
            setScripts(data.scripts);
            if (deviceProfiles.length > 0 && !activeProfileId) {
                setActiveProfileId(deviceProfiles[0].id);
                setButtons([...deviceProfiles[0].buttons]);
            }
        } catch (err) {
            console.error('[DetectDevice] Failed:', err);
            addToast({
                type: 'error',
                message: `Device detection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }, [addToast, activeProfileId]);

    // ─── Device selection ──────────────────────────────────────────────────────

    const selectDevice = useCallback((id: string) => {
        const dev = devicesRef.current.find(d => d.unitId === id);
        if (!dev) {
            console.warn('[selectDevice] Unknown device ID:', id);
            return;
        }

        setDevice(dev);
        setActiveDeviceId(id);

        // Switch to the selected device's profiles
        const deviceProfiles = allProfilesRef.current.filter(p => p.deviceName === id);
        setProfiles(deviceProfiles);

        if (deviceProfiles.length > 0) {
            setActiveProfileId(deviceProfiles[0].id);
            setButtons([...deviceProfiles[0].buttons]);
        } else {
            setActiveProfileId(null);
            setButtons([]);
        }
        setDirty(false);
        setSelectedCid(null);
        setSaveStatus('idle');
        setApplyStatus('idle');
        setLayoutEditMode(false);

        // Persist active device to preferences (non-critical)
        fetch('/api/active-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: id }),
        }).catch(err => console.warn('[selectDevice] Failed to persist active device:', err));
    }, []);

    // ─── Button updates ────────────────────────────────────────────────────────

    const updateButton = useCallback((cid: number, changes: Partial<ButtonConfig>) => {
        setButtons(prev => {
            const existing = prev.find(b => b.cid === cid);
            if (existing) {
                return prev.map(b => b.cid === cid ? { ...b, ...changes } : b);
            }
            // New button config
            return [...prev, { ...makeDefaultButtonConfig(cid), ...changes }];
        });
        setDirty(true);
        setSaveStatus('idle');
        setApplyStatus('idle');
    }, []);

    // ─── Save config (persist to DB without applying) ──────────────────────────

    const saveConfig = useCallback(async () => {
        if (!activeProfileId || !device) {
            addToast({ type: 'warning', message: 'No active profile or device' });
            return;
        }

        setSaveStatus('saving');
        try {
            const profile = profiles.find(p => p.id === activeProfileId);
            await saveConfigToDB({
                buttons,
                profileId: activeProfileId,
                deviceId: device.unitId,
                profileName: profile?.name || 'Default',
            });
            setSaveStatus('saved');
            setDirty(false);
            addToast({ type: 'success', message: 'Configuration saved' });

            // Update the profile's buttons in local state (filtered + all)
            const updater = (p: Profile) =>
                p.id === activeProfileId
                    ? { ...p, buttons: [...buttons], updatedAt: new Date().toISOString() }
                    : p;
            setProfiles(prev => prev.map(updater));
            allProfilesRef.current = allProfilesRef.current.map(updater);
        } catch (err) {
            setSaveStatus('error');
            addToast({
                type: 'error',
                message: `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }, [activeProfileId, device, buttons, profiles, addToast]);

    // ─── Apply config (full pipeline: save → generate YAML → apply to Solaar) ─

    const applyCurrentConfig = useCallback(async () => {
        if (!activeProfileId || !device) {
            addToast({ type: 'warning', message: 'No active profile or device' });
            return;
        }

        setApplyStatus('applying');
        try {
            const profile = profiles.find(p => p.id === activeProfileId);
            // Build SolaarConfig from device + buttons
            const divertKeys: Record<number, 0 | 1 | 2> = {};
            for (const btn of buttons) {
                if (btn.gestureMode) {
                    divertKeys[btn.cid] = 2; // Mouse Gestures mode
                } else if (btn.simpleAction.type !== 'None') {
                    divertKeys[btn.cid] = 2; // Mode 2 needed: rules use MouseGesture condition
                } else {
                    divertKeys[btn.cid] = 0; // Default — reset to normal
                }
            }

            const solaarConfig: SolaarConfig = {
                deviceName: device.solaarName,
                unitId: device.unitId,
                dpi: profile?.dpi || device.maxDpi,
                divertKeys,
                rules: [], // Rules are generated by the backend from buttons
            };

            await apiApplyConfig(solaarConfig, buttons, activeProfileId);
            setApplyStatus('applied');
            setDirty(false);
            setSaveStatus('saved');
            setAppliedProfileId(activeProfileId);
            addToast({ type: 'success', message: 'Configuration applied to Solaar!' });

            // Notify server of active profile change
            fetch('/api/active-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: activeProfileId }),
            }).catch(() => { /* non-critical */ });

            // Update the profile's buttons in local state (filtered + all)
            const updater = (p: Profile) =>
                p.id === activeProfileId
                    ? { ...p, buttons: [...buttons], updatedAt: new Date().toISOString() }
                    : p;
            setProfiles(prev => prev.map(updater));
            allProfilesRef.current = allProfilesRef.current.map(updater);
        } catch (err) {
            setApplyStatus('error');
            addToast({
                type: 'error',
                message: `Apply failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                duration: 8000,
            });
        }
    }, [activeProfileId, device, buttons, profiles, addToast]);

    // ─── Profile management ────────────────────────────────────────────────────

    const createNewProfile = useCallback(async (name: string, windowClasses?: string[], cloneFromProfileId?: string) => {
        if (!device) {
            addToast({ type: 'warning', message: 'No device connected' });
            return;
        }

        try {
            // If cloning, copy buttons from the source profile (search all profiles); otherwise use blank defaults
            let baseButtons: ButtonConfig[];
            if (cloneFromProfileId) {
                const source = allProfilesRef.current.find(p => p.id === cloneFromProfileId);
                baseButtons = source
                    ? JSON.parse(JSON.stringify(source.buttons))
                    : device.buttons.filter(b => b.divertable).map(b => makeDefaultButtonConfig(b.cid));
            } else {
                baseButtons = device.buttons
                    .filter(b => b.divertable)
                    .map(b => makeDefaultButtonConfig(b.cid));
            }

            const profile: Profile = {
                id: '',
                name,
                deviceName: device.unitId,
                buttons: baseButtons,
                windowClasses: windowClasses?.length ? windowClasses : undefined,
                createdAt: '',
                updatedAt: '',
            };
            const created = await apiSaveProfile(profile);
            // Update both the filtered list (visible profiles) and the all-profiles ref
            setProfiles(prev => [...prev, created]);
            allProfilesRef.current = [...allProfilesRef.current, created];
            setActiveProfileId(created.id);
            setButtons([...created.buttons]);
            setDirty(false);
            setSelectedCid(null);
            setSaveStatus('idle');
            setApplyStatus('idle');
            addToast({ type: 'success', message: `Profile "${name}" created` });
        } catch (err) {
            addToast({
                type: 'error',
                message: `Create failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }, [device, addToast]);

    const deleteCurrentProfile = useCallback(async () => {
        if (!activeProfileId) return;

        const profile = profiles.find(p => p.id === activeProfileId);
        if (!profile) return;

        try {
            await apiDeleteProfile(activeProfileId);
            const remaining = profiles.filter(p => p.id !== activeProfileId);
            setProfiles(remaining);
            allProfilesRef.current = allProfilesRef.current.filter(p => p.id !== activeProfileId);
            if (remaining.length > 0) {
                setActiveProfileId(remaining[0].id);
                setButtons([...remaining[0].buttons]);
            } else {
                setActiveProfileId(null);
                setButtons([]);
            }
            setDirty(false);
            setSelectedCid(null);
            addToast({ type: 'success', message: `Profile "${profile.name}" deleted` });
        } catch (err) {
            addToast({
                type: 'error',
                message: `Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }, [activeProfileId, profiles, addToast]);

    const updateProfileMeta = useCallback(async (id: string, changes: Partial<Profile>) => {
        try {
            const updated = await apiUpdateProfile(id, changes);
            setProfiles(prev => prev.map(p => p.id === id ? updated : p));
            allProfilesRef.current = allProfilesRef.current.map(p => p.id === id ? updated : p);
            addToast({ type: 'success', message: 'Profile updated' });
        } catch (err) {
            addToast({
                type: 'error',
                message: `Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }, [addToast]);

    // ─── SSE subscription ──────────────────────────────────────────────────────

    useEffect(() => {
        const es = new EventSource('/api/events');

        es.addEventListener('profile-switched', (e) => {
            try {
                const { profileId, profileName, trigger } = JSON.parse(e.data);
                setAppliedProfileId(profileId);
                if (trigger === 'watcher') {
                    // Switch the UI to the watcher-selected profile
                    setActiveProfileId(profileId);
                    // Search allProfilesRef so we find the profile even if it belongs to
                    // a device different from the one currently shown in the UI
                    const profile = allProfilesRef.current.find(p => p.id === profileId);
                    if (profile) {
                        setButtons([...profile.buttons]);
                    }
                    setDirty(false);
                    setSelectedCid(null);
                    setSaveStatus('idle');
                    setApplyStatus('idle');
                    const label = profileName || 'unknown';
                    addToast({ type: 'info', message: `Auto-switched to profile "${label}"` });
                }
            } catch { /* ignore parse errors */ }
        });

        es.addEventListener('watcher-status', (e) => {
            try {
                const { active } = JSON.parse(e.data);
                setWindowWatcherActive(active);
            } catch { /* ignore parse errors */ }
        });

        es.addEventListener('config-applied', () => {
            // Could refresh data if needed
        });

        return () => es.close();
    }, [addToast]);

    // ─── Context value ─────────────────────────────────────────────────────────

    return (
        <AppContext.Provider value={{
            appStatus,
            device,
            devices,
            activeDeviceId,
            profiles,
            activeProfileId,
            appliedProfileId,
            buttons,
            scripts,
            systemActions,
            saveStatus,
            applyStatus,
            toasts,
            windowWatcherActive,
            selectedCid,
            dirty,
            isLayoutEditMode,

            bootstrap,
            detectDevice,
            selectDevice,
            selectProfile,
            setSelectedCid,
            updateButton,
            saveConfig,
            applyCurrentConfig,
            addToast,
            removeToast,
            setWindowWatcherActive,
            setLayoutEditMode,
            createNewProfile,
            deleteCurrentProfile,
            updateProfileMeta,
        }}>
            {children}
        </AppContext.Provider>
    );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
