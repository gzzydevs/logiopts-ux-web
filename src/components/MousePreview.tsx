import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ActionConfigurator } from './ActionConfigurator';
import classNames from 'classnames';
import './MousePreview.css';

const GenericMouseSVG = () => (
    <svg viewBox="0 0 200 350" fill="none" xmlns="http://www.w3.org/2000/svg" className="mouse-img">
        <rect x="50" y="20" width="100" height="310" rx="50" fill="#1e1f26" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
        <path d="M50 120 Q100 150 150 120" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" fill="none" />
        <rect x="90" y="40" width="20" height="50" rx="10" fill="#ffffff" fillOpacity="0.05" />
        <path d="M100 20 L100 135" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
);

/*
 * Maps button position string (from KnownButton.position) to CSS class and label side.
 *
 * labelSide controls whether the text label appears to the LEFT or RIGHT of the dot.
 *  - Left-side nodes (left ≤ 25%) → labels go RIGHT  (toward center)
 *  - Right-side nodes (left ≥ 45%) → labels go LEFT   (toward center)
 */
const POSITION_CONFIG: Record<string, { className: string; labelSide: 'left' | 'right' }> = {
    forward: { className: 'node-forward', labelSide: 'right' },
    back: { className: 'node-back', labelSide: 'right' },
    middle: { className: 'node-middle', labelSide: 'left' },
    dpiSwitch: { className: 'node-shift', labelSide: 'left' },
    scrollMode: { className: 'node-scroll', labelSide: 'left' },
    scrollLeft: { className: 'node-sleft', labelSide: 'right' },
    scrollRight: { className: 'node-sright', labelSide: 'left' },
    left: { className: 'node-left', labelSide: 'right' },
    right: { className: 'node-right', labelSide: 'left' },
};

/** Determine label side from X position (layout-based) */
function labelSideFromX(x: number): 'left' | 'right' {
    return x < 50 ? 'right' : 'left';
}

interface MousePreviewProps {
    editMode?: boolean;
}

export const MousePreview: React.FC<MousePreviewProps> = ({ editMode = false }) => {
    const { device, selectedCid, setSelectedCid, buttons } = useAppContext();

    if (!device) return null;

    // In edit mode, show ALL buttons (including non-divertable) so user can position them.
    // In normal mode, only show divertable buttons.
    const hasAnyDivertable = device.buttons.some(b => b.divertable);
    const visibleButtons = editMode
        ? device.buttons
        : (hasAnyDivertable
            ? device.buttons.filter(b => b.divertable)
            : device.buttons);

    // Find the selected button info for the configurator
    const selectedButton = device.buttons.find(b => b.cid === selectedCid);
    const selectedConfig = buttons.find(b => b.cid === selectedCid);

    return (
        <div className="preview-container">
            <div className="mouse-device">
                <GenericMouseSVG />

                {visibleButtons.map(btn => {
                    const hasLayout = btn.layoutX !== undefined && btn.layoutY !== undefined;
                    const posConfig = POSITION_CONFIG[btn.position] || {
                        className: `node-pos-${btn.position}`,
                        labelSide: 'right' as const,
                    };

                    // If button has layout coordinates, use inline positioning
                    const inlineStyle = hasLayout
                        ? { top: `${btn.layoutY}%`, left: `${btn.layoutX}%` }
                        : undefined;

                    const labelSide = btn.labelSide
                        ? btn.labelSide
                        : hasLayout
                            ? labelSideFromX(btn.layoutX!)
                            : posConfig.labelSide;

                    return (
                        <div
                            key={btn.cid}
                            className={classNames('node', {
                                [posConfig.className]: !hasLayout,
                                active: selectedCid === btn.cid,
                                'non-divertable': !btn.divertable && !editMode,
                            })}
                            style={inlineStyle}
                            onClick={() => {
                                if (editMode) return; // Don't select buttons in edit mode
                                if (btn.divertable) {
                                    setSelectedCid(selectedCid === btn.cid ? null : btn.cid);
                                }
                            }}
                            title={btn.divertable ? btn.name : `${btn.name} (not configurable)`}
                        >
                            <div className={classNames('node-label-container', `label-${labelSide}`)}>
                                <div className="node-label">{btn.name}</div>
                            </div>
                            {(() => {
                                const cfg = buttons.find(b => b.cid === btn.cid);
                                const action = cfg?.gestureMode ? undefined : cfg?.simpleAction;
                                return action?.type === 'RunScript' ? (
                                    <span className="button-badge script-badge" title="Script">⚡</span>
                                ) : null;
                            })()}
                        </div>
                    );
                })}
            </div>

            {!editMode && selectedCid !== null && selectedButton && (
                <ActionConfigurator
                    cid={selectedCid}
                    button={selectedButton}
                    config={selectedConfig}
                    onClose={() => setSelectedCid(null)}
                />
            )}
        </div>
    );
};
