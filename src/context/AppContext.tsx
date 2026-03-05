import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface MacroSlot {
    type: 'system' | 'bash' | 'keyboard' | null;
    value: string;
}

export interface ButtonConfig {
    buttonId: string;
    click: MacroSlot;
    up: MacroSlot;
    down: MacroSlot;
    left: MacroSlot;
    right: MacroSlot;
}

export interface Profile {
    id: string;
    name: string;
    icon: string;
    buttonConfigs: Record<string, ButtonConfig>;
}

export interface Device {
    id: string;
    name: string;
    imageUrl: string;
}

interface AppContextType {
    solaarStatus: 'loading' | 'connected' | 'error';
    setSolaarStatus: (status: 'loading' | 'connected' | 'error') => void;
    mocksMode: boolean;
    setMocksMode: (mode: boolean) => void;
    windowWatcherActive: boolean;
    setWindowWatcherActive: (active: boolean) => void;
    devices: Device[];
    selectedDeviceId: string | null;
    setSelectedDeviceId: (id: string) => void;
    profiles: Profile[];
    selectedProfileId: string | null;
    setSelectedProfileId: (id: string) => void;
    updateButtonConfig: (profileId: string, buttonId: string, config: Partial<ButtonConfig>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initial mock data
const mockDevices: Device[] = [
    { id: 'mx-master-3', name: 'MX Master 3', imageUrl: '' },
    { id: 'lift', name: 'Logitech Lift', imageUrl: '' }
];

const mockProfiles: Profile[] = [
    {
        id: 'global',
        name: 'Global',
        icon: 'Globe',
        buttonConfigs: {}
    },
    {
        id: 'chrome',
        name: 'Google Chrome',
        icon: 'Chrome',
        buttonConfigs: {}
    }
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [solaarStatus, setSolaarStatus] = useState<'loading' | 'connected' | 'error'>('loading');
    const [mocksMode, setMocksMode] = useState<boolean>(true);
    const [windowWatcherActive, setWindowWatcherActive] = useState<boolean>(false);
    const [devices] = useState<Device[]>(mockDevices);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(mockDevices[0].id);
    const [profiles, setProfiles] = useState<Profile[]>(mockProfiles);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(mockProfiles[0].id);

    const updateButtonConfig = (profileId: string, buttonId: string, config: Partial<ButtonConfig>) => {
        setProfiles(prev => prev.map(p => {
            if (p.id !== profileId) return p;
            const currentBtn = p.buttonConfigs[buttonId] || {
                buttonId,
                click: { type: null, value: '' },
                up: { type: null, value: '' },
                down: { type: null, value: '' },
                left: { type: null, value: '' },
                right: { type: null, value: '' }
            };
            return {
                ...p,
                buttonConfigs: {
                    ...p.buttonConfigs,
                    [buttonId]: { ...currentBtn, ...config }
                }
            };
        }));
    };

    return (
        <AppContext.Provider value={{
            solaarStatus, setSolaarStatus,
            mocksMode, setMocksMode,
            windowWatcherActive, setWindowWatcherActive,
            devices, selectedDeviceId, setSelectedDeviceId,
            profiles, selectedProfileId, setSelectedProfileId,
            updateButtonConfig
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
