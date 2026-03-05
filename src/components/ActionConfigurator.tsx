import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, MousePointerClick, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAppContext, MacroSlot, ButtonConfig } from '../context/AppContext';
import './ActionConfigurator.css';

interface Props {
    buttonId: string;
    buttonLabel: string;
    onClose: () => void;
}

const SLOT_KEYS: (keyof ButtonConfig)[] = ['click', 'up', 'down', 'left', 'right'];

const SLOT_ICONS: Record<string, React.ReactNode> = {
    click: <MousePointerClick size={16} />,
    up: <ArrowUp size={16} />,
    down: <ArrowDown size={16} />,
    left: <ArrowLeft size={16} />,
    right: <ArrowRight size={16} />
};

export const ActionConfigurator: React.FC<Props> = ({ buttonId, buttonLabel, onClose }) => {
    const { t } = useTranslation();
    const { profiles, selectedProfileId, updateButtonConfig } = useAppContext();

    const activeProfile = profiles.find(p => p.id === selectedProfileId);
    const config = activeProfile?.buttonConfigs[buttonId] || {
        buttonId,
        click: { type: null, value: '' },
        up: { type: null, value: '' },
        down: { type: null, value: '' },
        left: { type: null, value: '' },
        right: { type: null, value: '' }
    };

    const handleTypeChange = (slot: keyof ButtonConfig, newType: MacroSlot['type']) => {
        if (!selectedProfileId) return;
        updateButtonConfig(selectedProfileId, buttonId, {
            [slot]: { type: newType, value: '' }
        });
    };

    const handleValueChange = (slot: keyof ButtonConfig, newValue: string) => {
        if (!selectedProfileId) return;
        const currentType = (config[slot] as MacroSlot).type;
        updateButtonConfig(selectedProfileId, buttonId, {
            [slot]: { type: currentType, value: newValue }
        });
    };

    return (
        <div className="configurator-overlay">
            <div className="config-header">
                <h2>{buttonLabel}</h2>
                <button className="close-btn" onClick={onClose}><X size={20} /></button>
            </div>

            <div className="slots-container">
                {SLOT_KEYS.map((slotKey) => {
                    const slotData = config[slotKey] as MacroSlot;
                    const labelKey = `macro.slot_${slotKey}`;

                    return (
                        <div className="macro-slot" key={slotKey}>
                            <div className="slot-header">
                                <span className="slot-icon">{SLOT_ICONS[slotKey]}</span>
                                {t(labelKey)}
                            </div>

                            <div className="action-selector">
                                <select
                                    className="select-type"
                                    value={slotData.type || ''}
                                    onChange={(e) => handleTypeChange(slotKey, e.target.value as MacroSlot['type'] || null)}
                                >
                                    <option value="">{t('macro.select_action_type')}</option>
                                    <option value="system">{t('macro.system_action')}</option>
                                    <option value="bash">{t('macro.bash_script')}</option>
                                    <option value="keyboard">{t('macro.keyboard_shortcut')}</option>
                                </select>

                                {slotData.type === 'system' && (
                                    <select
                                        className="select-type"
                                        value={slotData.value}
                                        onChange={(e) => handleValueChange(slotKey, e.target.value)}
                                    >
                                        <option value="">Select action...</option>
                                        <option value="copy">Copy</option>
                                        <option value="paste">Paste</option>
                                        <option value="undo">Undo</option>
                                        <option value="play_pause">Play/Pause</option>
                                    </select>
                                )}

                                {slotData.type === 'bash' && (
                                    <input
                                        type="text"
                                        className="action-input"
                                        placeholder="e.g. script.sh"
                                        value={slotData.value}
                                        onChange={(e) => handleValueChange(slotKey, e.target.value)}
                                    />
                                )}

                                {slotData.type === 'keyboard' && (
                                    <input
                                        type="text"
                                        className="action-input"
                                        placeholder="e.g. Ctrl+C"
                                        value={slotData.value}
                                        onChange={(e) => handleValueChange(slotKey, e.target.value)}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
