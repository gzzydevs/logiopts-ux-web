import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronDown, Save, Zap, Loader2, Check, AlertCircle, Search, Battery, PenLine } from 'lucide-react';
import './Topbar.css';

export const Topbar: React.FC = () => {
    const {
        device, detectDevice,
        profiles, activeProfileId, appliedProfileId, selectProfile,
        saveStatus, applyStatus, dirty,
        saveConfig, applyCurrentConfig,
        isLayoutEditMode, setLayoutEditMode,
    } = useAppContext();

    return (
        <header className="topbar">
            <div className="brand" style={{ marginRight: 'auto' }}>
                <h1>LogiTux</h1>
                <span>MACROS CONFIGURATOR</span>
            </div>

            {/* Edit mode badge */}
            {isLayoutEditMode && (
                <div className="layout-mode-indicator">
                    <PenLine size={14} />
                    <span>EDIT MODE</span>
                </div>
            )}

            {/* Device display */}
            <div className="device-selector" style={{ marginRight: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {device ? (
                    <>
                        <span className="device-name">{device.displayName}</span>
                        {device.battery >= 0 && (
                            <span className="device-battery" title={`Battery: ${device.battery}%`}>
                                <Battery size={14} />
                                {device.battery}%
                            </span>
                        )}
                    </>
                ) : (
                    <button
                        className="detect-btn"
                        onClick={detectDevice}
                        title="Detect Logitech device via Solaar"
                    >
                        <Search size={16} />
                        Detect Device
                    </button>
                )}
            </div>

            {/* Profile selector */}
            <div className="profiles-selector">
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginRight: '8px' }}>Profile:</span>
                {profiles.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                        <select
                            className="device-dropdown"
                            value={activeProfileId || ''}
                            onChange={(e) => selectProfile(e.target.value)}
                            disabled={isLayoutEditMode}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)',
                                color: 'white',
                                padding: '8px 32px 8px 16px',
                                borderRadius: '20px',
                                appearance: 'none',
                                outline: 'none',
                                fontSize: '0.9rem',
                                cursor: isLayoutEditMode ? 'not-allowed' : 'pointer',
                                opacity: isLayoutEditMode ? 0.4 : 1,
                            }}
                        >
                            {profiles.map(p => (
                                <option key={p.id} value={p.id} style={{ background: '#1a1b26' }}>
                                    {p.name}{p.id === appliedProfileId ? ' ● Active' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} color="var(--text-secondary)" style={{ marginLeft: '-30px', pointerEvents: 'none' }} />
                    </div>
                ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No profiles</span>
                )}
            </div>

            {/* Save & Apply & Layout buttons */}
            <div className="topbar-actions" style={{ marginLeft: '24px', display: 'flex', gap: '8px' }}>
                {!isLayoutEditMode && device && (
                    <button
                        className="action-btn layout-edit-btn"
                        onClick={() => setLayoutEditMode(true)}
                        title="Edit button positions on the mouse"
                    >
                        <PenLine size={16} />
                        Layout
                    </button>
                )}
                <button
                    className={`action-btn save-btn ${saveStatus}`}
                    onClick={saveConfig}
                    disabled={saveStatus === 'saving' || !activeProfileId || !dirty || isLayoutEditMode}
                    title="Save configuration to database"
                >
                    {saveStatus === 'saving' ? (
                        <Loader2 size={16} className="spin-icon" />
                    ) : saveStatus === 'saved' ? (
                        <Check size={16} />
                    ) : saveStatus === 'error' ? (
                        <AlertCircle size={16} />
                    ) : (
                        <Save size={16} />
                    )}
                    Save
                </button>
                <button
                    className={`action-btn apply-btn ${applyStatus}`}
                    onClick={applyCurrentConfig}
                    disabled={applyStatus === 'applying' || !activeProfileId || isLayoutEditMode}
                    title="Apply configuration to Solaar"
                >
                    {applyStatus === 'applying' ? (
                        <Loader2 size={16} className="spin-icon" />
                    ) : applyStatus === 'applied' ? (
                        <Check size={16} />
                    ) : applyStatus === 'error' ? (
                        <AlertCircle size={16} />
                    ) : (
                        <Zap size={16} />
                    )}
                    Apply
                </button>
            </div>
        </header>
    );
};
