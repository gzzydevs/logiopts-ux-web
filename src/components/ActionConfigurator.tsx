import React from 'react';
import { X, MousePointerClick, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import ActionPicker from './ActionPicker';
import type { KnownButton, ButtonConfig, SolaarAction, GestureDirection } from '../types';
import './ActionConfigurator.css';

interface Props {
    cid: number;
    button: KnownButton;
    config?: ButtonConfig;
    onClose: () => void;
}

const GESTURE_DIRS: GestureDirection[] = ['None', 'Up', 'Down', 'Left', 'Right'];

const DIR_ICONS: Record<GestureDirection, React.ReactNode> = {
    None: <MousePointerClick size={16} />,
    Up: <ArrowUp size={16} />,
    Down: <ArrowDown size={16} />,
    Left: <ArrowLeft size={16} />,
    Right: <ArrowRight size={16} />,
};

const DIR_LABELS: Record<GestureDirection, string> = {
    None: '🖱️ Click',
    Up: '⬆️ Up',
    Down: '⬇️ Down',
    Left: '⬅️ Left',
    Right: '➡️ Right',
};

const NONE_ACTION: SolaarAction = { type: 'None' };

function makeDefaultConfig(cid: number): ButtonConfig {
    return {
        cid,
        gestureMode: false,
        gestures: {
            None: NONE_ACTION,
            Up: NONE_ACTION,
            Down: NONE_ACTION,
            Left: NONE_ACTION,
            Right: NONE_ACTION,
        } as Record<GestureDirection, SolaarAction>,
        simpleAction: NONE_ACTION,
    };
}

export const ActionConfigurator: React.FC<Props> = ({ cid, button, config: externalConfig, onClose }) => {
    const { updateButton, systemActions } = useAppContext();

    const config = externalConfig || makeDefaultConfig(cid);
    const canGesture = button.divertable && button.rawXy;

    const setGestureMode = (gestureMode: boolean) => {
        updateButton(cid, { gestureMode });
    };

    const setGestureAction = (dir: GestureDirection, action: SolaarAction) => {
        updateButton(cid, {
            gestures: { ...config.gestures, [dir]: action },
        });
    };

    const setSimpleAction = (action: SolaarAction) => {
        updateButton(cid, { simpleAction: action });
    };

    return (
        <div className="configurator-overlay">
            <div className="config-header">
                <div>
                    <h2>{button.name}</h2>
                    <span className="cid-badge" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                        CID {button.cid}
                    </span>
                </div>
                <button className="close-btn" onClick={onClose}><X size={20} /></button>
            </div>

            {/* Button capability flags */}
            <div className="button-flags" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {button.divertable && <span className="flag">Divertable</span>}
                {button.rawXy && <span className="flag">Raw XY</span>}
                {button.reprogrammable && <span className="flag">Reprog</span>}
            </div>

            {!button.divertable ? (
                <p className="hint" style={{ color: 'var(--text-secondary)' }}>
                    This button cannot be diverted (reconfigured).
                </p>
            ) : (
                <>
                    {/* Mode toggle */}
                    {canGesture && (
                        <div className="mode-toggle" style={{
                            display: 'flex', gap: '8px', marginBottom: '16px',
                            padding: '4px', background: 'rgba(255,255,255,0.03)',
                            borderRadius: '8px',
                        }}>
                            <button
                                className={`mode-btn ${!config.gestureMode ? 'active' : ''}`}
                                onClick={() => setGestureMode(false)}
                                style={{
                                    flex: 1, padding: '8px', border: 'none',
                                    borderRadius: '6px', cursor: 'pointer',
                                    background: !config.gestureMode ? 'var(--accent)' : 'transparent',
                                    color: !config.gestureMode ? 'white' : 'var(--text-secondary)',
                                    fontSize: '0.8rem', transition: 'all 0.2s',
                                }}
                            >
                                Simple Action
                            </button>
                            <button
                                className={`mode-btn ${config.gestureMode ? 'active' : ''}`}
                                onClick={() => setGestureMode(true)}
                                style={{
                                    flex: 1, padding: '8px', border: 'none',
                                    borderRadius: '6px', cursor: 'pointer',
                                    background: config.gestureMode ? 'var(--accent)' : 'transparent',
                                    color: config.gestureMode ? 'white' : 'var(--text-secondary)',
                                    fontSize: '0.8rem', transition: 'all 0.2s',
                                }}
                            >
                                Mouse Gestures
                            </button>
                        </div>
                    )}

                    {/* Action configuration */}
                    <div className="slots-container">
                        {config.gestureMode && canGesture ? (
                            /* Gesture mode: 5 direction slots */
                            GESTURE_DIRS.map(dir => (
                                <div className="macro-slot" key={dir}>
                                    <div className="slot-header">
                                        <span className="slot-icon">{DIR_ICONS[dir]}</span>
                                        {DIR_LABELS[dir]}
                                    </div>
                                    <ActionPicker
                                        value={config.gestures[dir] || NONE_ACTION}
                                        onChange={action => setGestureAction(dir, action)}
                                        systemActions={systemActions}
                                    />
                                </div>
                            ))
                        ) : (
                            /* Simple mode: single action */
                            <div className="macro-slot">
                                <div className="slot-header">
                                    <span className="slot-icon"><MousePointerClick size={16} /></span>
                                    Action
                                </div>
                                <ActionPicker
                                    value={config.simpleAction}
                                    onChange={setSimpleAction}
                                    systemActions={systemActions}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
