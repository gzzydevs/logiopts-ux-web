import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
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
    profiles: Profile[];
    activeProfileId: string | null;
    buttons: ButtonConfig[];
    scripts: Script[];
    systemActions: SystemAction[];
    saveStatus: SaveStatus;
    applyStatus: ApplyStatus;
    toasts: Toast[];
    windowWatcherActive: boolean;
    selectedCid: number | null;
    dirty: boolean;

    // Actions
    bootstrap: () => Promise<void>;
    detectDevice: () => Promise<void>;
    selectProfile: (id: string) => void;
    setSelectedCid: (cid: number | null) => void;
    updateButton: (cid: number, changes: Partial<ButtonConfig>) => void;
    saveConfig: () => Promise<void>;
    applyCurrentConfig: () => Promise<void>;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    setWindowWatcherActive: (active: boolean) => void;
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
    const toastIdRef = useRef(0);

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

            // Set device (first one, or null)
            const dev = data.devices.length > 0 ? data.devices[0] : null;
            setDevice(dev);

            // Set profiles
            setProfiles(data.profiles);

            // Set scripts
            setScripts(data.scripts);

            // Load system actions
            try {
                const actions = await fetchSystemActions();
                setSystemActions(actions);
            } catch {
                // Non-critical, continue without system actions
            }

            // Select first profile or clear
            if (data.profiles.length > 0) {
                const firstProfile = data.profiles[0];
                setActiveProfileId(firstProfile.id);
                setButtons([...firstProfile.buttons]);
            }

            setAppStatus(dev ? 'connected' : 'no-device');
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
            setDevice(resp.device);
            setAppStatus('connected');
            addToast({ type: 'success', message: `Detected: ${resp.device.displayName}` });

            // Re-bootstrap to get updated data
            const data = await fetchBootstrap();
            setProfiles(data.profiles);
            setScripts(data.scripts);
            if (data.profiles.length > 0 && !activeProfileId) {
                setActiveProfileId(data.profiles[0].id);
                setButtons([...data.profiles[0].buttons]);
            }
        } catch (err) {
            console.error('[DetectDevice] Failed:', err);
            addToast({
                type: 'error',
                message: `Device detection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        }
    }, [addToast, activeProfileId]);

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

            // Update the profile's buttons in local state
            setProfiles(prev => prev.map(p =>
                p.id === activeProfileId
                    ? { ...p, buttons: [...buttons], updatedAt: new Date().toISOString() }
                    : p
            ));
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
                    divertKeys[btn.cid] = 1; // Diverted
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
            addToast({ type: 'success', message: 'Configuration applied to Solaar!' });

            // Update the profile's buttons in local state
            setProfiles(prev => prev.map(p =>
                p.id === activeProfileId
                    ? { ...p, buttons: [...buttons], updatedAt: new Date().toISOString() }
                    : p
            ));
        } catch (err) {
            setApplyStatus('error');
            addToast({
                type: 'error',
                message: `Apply failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                duration: 8000,
            });
        }
    }, [activeProfileId, device, buttons, profiles, addToast]);

    // ─── Context value ─────────────────────────────────────────────────────────

    return (
        <AppContext.Provider value={{
            appStatus,
            device,
            profiles,
            activeProfileId,
            buttons,
            scripts,
            systemActions,
            saveStatus,
            applyStatus,
            toasts,
            windowWatcherActive,
            selectedCid,
            dirty,

            bootstrap,
            detectDevice,
            selectProfile,
            setSelectedCid,
            updateButton,
            saveConfig,
            applyCurrentConfig,
            addToast,
            removeToast,
            setWindowWatcherActive,
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
