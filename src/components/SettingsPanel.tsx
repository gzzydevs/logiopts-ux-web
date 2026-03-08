import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import ScriptManager from './ScriptManager';
import { setPreference } from '../hooks/useApi';
import './SettingsPanel.css';

export const SettingsPanel: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { windowWatcherActive, setWindowWatcherActive, scriptsEnabled, setScriptsEnabled } = useAppContext();
    const [autostart, setAutostartState] = useState(false);

    useEffect(() => {
        fetch('/api/watcher/status')
            .then(res => res.json())
            .then(data => setWindowWatcherActive(data.active))
            .catch(console.error);

        // Load autostart state when running in Electron
        if (window.electronAPI) {
            window.electronAPI.getAutostart().then(setAutostartState);
        }
    }, [setWindowWatcherActive]);

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en');
    };

    const handleWatcherToggle = async (checked: boolean) => {
        setWindowWatcherActive(checked);
        await fetch('/api/watcher/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: checked })
        }).catch(console.error);
    };

    const handleScriptsToggle = async (checked: boolean) => {
        setScriptsEnabled(checked);
        await setPreference('scriptsEnabled', String(checked));
    };

    const handleAutostartToggle = async (checked: boolean) => {
        if (window.electronAPI) {
            await window.electronAPI.setAutostart(checked);
            setAutostartState(checked);
        }
    };

    return (
        <aside className="settings-panel">
            <h3>Settings</h3>

            <div className="setting-item">
                <span>{t('app.window_watcher')}</span>
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={windowWatcherActive}
                        onChange={(e) => handleWatcherToggle(e.target.checked)}
                    />
                    <span className="slider"></span>
                </label>
            </div>

            <div className="setting-item">
                <span>System Scripts</span>
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={scriptsEnabled}
                        onChange={(e) => handleScriptsToggle(e.target.checked)}
                    />
                    <span className="slider"></span>
                </label>
            </div>

            <div className="setting-item">
                <span>Language</span>
                <button
                    onClick={toggleLanguage}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    {i18n.language.toUpperCase()}
                </button>
            </div>

            {window.electronAPI && (
                <div className="setting-item">
                    <span>Autostart</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={autostart}
                            onChange={(e) => handleAutostartToggle(e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            )}

            <div className="setting-divider" />
            {scriptsEnabled && <ScriptManager />}

        </aside>
    );
};
