import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { Globe, Chrome, Code, Plus, ChevronDown } from 'lucide-react';
import './Topbar.css';

const IconMap: Record<string, React.ReactNode> = {
    Globe: <Globe size={18} />,
    Chrome: <Chrome size={18} />,
    VSCode: <Code size={18} />
};

export const Topbar: React.FC = () => {
    const { t } = useTranslation();
    const {
        profiles, selectedProfileId, setSelectedProfileId,
        devices, selectedDeviceId, setSelectedDeviceId
    } = useAppContext();

    return (
        <header className="topbar">
            <div className="brand" style={{ marginRight: 'auto' }}>
                <h1>LogiTux</h1>
                <span>MACROS CONFIGURATOR</span>
            </div>

            <div className="device-selector" style={{ marginRight: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Device:</span>
                <select
                    className="device-dropdown"
                    value={selectedDeviceId || ''}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border)',
                        color: 'white',
                        padding: '8px 32px 8px 16px',
                        borderRadius: '20px',
                        appearance: 'none',
                        outline: 'none',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    {devices.map(d => (
                        <option key={d.id} value={d.id} style={{ background: '#1a1b26' }}>{d.name}</option>
                    ))}
                </select>
                <ChevronDown size={16} color="var(--text-secondary)" style={{ marginLeft: '-30px', pointerEvents: 'none' }} />
            </div>

            <div className="profiles-selector">
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginRight: '8px' }}>Profile:</span>
                {profiles.map(p => (
                    <button
                        key={p.id}
                        className={`profile-btn ${p.id === selectedProfileId ? 'active' : ''}`}
                        onClick={() => setSelectedProfileId(p.id)}
                    >
                        {IconMap[p.icon] || <Globe size={18} />}
                        {p.name}
                    </button>
                ))}
                <button className="add-profile-btn" title={t('app.add_profile')}>
                    <Plus size={18} />
                </button>
            </div>
        </header>
    );
};
