import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import ScriptManager from './ScriptManager';
import './SettingsPanel.css';

export const SettingsPanel: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { windowWatcherActive, setWindowWatcherActive } = useAppContext();

    useEffect(() => {
        fetch('/api/watcher/status')
            .then(res => res.json())
            .then(data => setWindowWatcherActive(data.active))
            .catch(console.error);
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

            <div className="setting-divider" />
            <ScriptManager />

        </aside>
    );
};
