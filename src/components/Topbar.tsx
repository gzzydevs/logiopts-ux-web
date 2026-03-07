import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronDown, Save, Zap, Loader2, Check, AlertCircle, Search, Battery, PenLine, Plus, Trash2, X, AppWindow } from 'lucide-react';
import './Topbar.css';

export const Topbar: React.FC = () => {
    const {
        device, detectDevice,
        profiles, activeProfileId, appliedProfileId, selectProfile,
        saveStatus, applyStatus, dirty,
        saveConfig, applyCurrentConfig,
        isLayoutEditMode, setLayoutEditMode,
        createNewProfile, deleteCurrentProfile, updateProfileMeta,
    } = useAppContext();

    const [showNewProfile, setShowNewProfile] = useState(false);
    const [newName, setNewName] = useState('');
    const [newWindowClasses, setNewWindowClasses] = useState('');
    const [showProfileSettings, setShowProfileSettings] = useState(false);
    const [editWindowClasses, setEditWindowClasses] = useState('');

    const activeProfile = profiles.find(p => p.id === activeProfileId);

    const handleCreateProfile = async () => {
        if (!newName.trim()) return;
        const wc = newWindowClasses.split(',').map(s => s.trim()).filter(Boolean);
        await createNewProfile(newName.trim(), wc.length > 0 ? wc : undefined);
        setNewName('');
        setNewWindowClasses('');
        setShowNewProfile(false);
    };

    const handleOpenProfileSettings = () => {
        if (activeProfile) {
            setEditWindowClasses(activeProfile.windowClasses?.join(', ') || '');
        }
        setShowProfileSettings(true);
    };

    const handleSaveWindowClasses = async () => {
        if (!activeProfileId) return;
        const wc = editWindowClasses.split(',').map(s => s.trim()).filter(Boolean);
        await updateProfileMeta(activeProfileId, { windowClasses: wc.length > 0 ? wc : undefined });
        setShowProfileSettings(false);
    };

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
                            {profiles.map(p => {
                                const activeBadge = p.id === appliedProfileId ? ' ● Active' : '';
                                const appsSuffix = p.windowClasses?.length ? ` [${p.windowClasses.join(', ')}]` : '';
                                return (
                                    <option key={p.id} value={p.id} style={{ background: '#1a1b26' }}>
                                        {p.name}{activeBadge}{appsSuffix}
                                    </option>
                                );
                            })}
                        </select>
                        <ChevronDown size={16} color="var(--text-secondary)" style={{ marginLeft: '-30px', pointerEvents: 'none' }} />
                    </div>
                ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No profiles</span>
                )}

                {/* New Profile button */}
                {!isLayoutEditMode && device && (
                    <button
                        className="add-profile-btn"
                        onClick={() => setShowNewProfile(true)}
                        title="Create new profile"
                    >
                        <Plus size={16} />
                    </button>
                )}

                {/* Profile settings (window classes) button */}
                {!isLayoutEditMode && activeProfile && (
                    <button
                        className="profile-settings-btn"
                        onClick={handleOpenProfileSettings}
                        title="Configure app matching for this profile"
                    >
                        <AppWindow size={16} />
                    </button>
                )}

                {/* Delete profile button */}
                {!isLayoutEditMode && activeProfile && profiles.length > 1 && (
                    <button
                        className="profile-delete-btn"
                        onClick={deleteCurrentProfile}
                        title="Delete current profile"
                    >
                        <Trash2 size={14} />
                    </button>
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

            {/* New Profile Modal */}
            {showNewProfile && (
                <div className="topbar-modal-overlay" onClick={() => setShowNewProfile(false)}>
                    <div className="topbar-modal" onClick={e => e.stopPropagation()}>
                        <div className="topbar-modal-header">
                            <h3>New Profile</h3>
                            <button className="topbar-modal-close" onClick={() => setShowNewProfile(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="topbar-modal-body">
                            <label>
                                <span>Profile name</span>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Firefox, Gaming, Work..."
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreateProfile(); }}
                                />
                            </label>
                            <label>
                                <span>Window classes <small>(comma separated, for auto-switching)</small></span>
                                <input
                                    type="text"
                                    value={newWindowClasses}
                                    onChange={e => setNewWindowClasses(e.target.value)}
                                    placeholder="e.g. firefox, Navigator, chromium"
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreateProfile(); }}
                                />
                            </label>
                            <p className="topbar-modal-hint">
                                Window classes are used by the Window Watcher to auto-switch profiles when you focus an app.
                                Use <code>xdotool getactivewindow getwindowclassname</code> to find a window's class.
                            </p>
                        </div>
                        <div className="topbar-modal-actions">
                            <button className="action-btn" onClick={() => setShowNewProfile(false)}>Cancel</button>
                            <button
                                className="action-btn apply-btn"
                                onClick={handleCreateProfile}
                                disabled={!newName.trim()}
                            >
                                <Plus size={16} /> Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Settings Modal (Window Classes) */}
            {showProfileSettings && activeProfile && (
                <div className="topbar-modal-overlay" onClick={() => setShowProfileSettings(false)}>
                    <div className="topbar-modal" onClick={e => e.stopPropagation()}>
                        <div className="topbar-modal-header">
                            <h3>Profile: {activeProfile.name}</h3>
                            <button className="topbar-modal-close" onClick={() => setShowProfileSettings(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="topbar-modal-body">
                            <label>
                                <span>Window classes <small>(comma separated)</small></span>
                                <input
                                    type="text"
                                    value={editWindowClasses}
                                    onChange={e => setEditWindowClasses(e.target.value)}
                                    placeholder="e.g. firefox, Navigator, chromium"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveWindowClasses(); }}
                                />
                            </label>
                            <p className="topbar-modal-hint">
                                When Window Watcher is active and detects one of these window classes, this profile will be auto-applied to Solaar.
                                Leave empty for a general-purpose profile (no auto-switching).
                            </p>
                            {activeProfile.windowClasses && activeProfile.windowClasses.length > 0 && (
                                <div className="profile-wc-tags">
                                    {activeProfile.windowClasses.map(wc => (
                                        <span key={wc} className="wc-tag">{wc}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="topbar-modal-actions">
                            <button className="action-btn" onClick={() => setShowProfileSettings(false)}>Cancel</button>
                            <button
                                className="action-btn apply-btn"
                                onClick={handleSaveWindowClasses}
                            >
                                <Check size={16} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
