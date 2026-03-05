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

export const MousePreview: React.FC = () => {
    const { device, selectedCid, setSelectedCid, buttons } = useAppContext();

    if (!device) return null;

    // Find the selected button info for the configurator
    const selectedButton = device.buttons.find(b => b.cid === selectedCid);
    const selectedConfig = buttons.find(b => b.cid === selectedCid);

    return (
        <div className="preview-container">
            <div className="mouse-device">
                <GenericMouseSVG />

                {device.buttons.map(btn => {
                    const posConfig = POSITION_CONFIG[btn.position] || {
                        className: `node-pos-${btn.position}`,
                        labelSide: 'right' as const,
                    };

                    return (
                        <div
                            key={btn.cid}
                            className={classNames('node', posConfig.className, {
                                active: selectedCid === btn.cid,
                                'non-divertable': !btn.divertable,
                            })}
                            onClick={() => {
                                if (btn.divertable) {
                                    setSelectedCid(selectedCid === btn.cid ? null : btn.cid);
                                }
                            }}
                            title={btn.divertable ? btn.name : `${btn.name} (not configurable)`}
                        >
                            <div className={classNames('node-label-container', `label-${posConfig.labelSide}`)}>
                                <div className="node-label">{btn.name}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedCid !== null && selectedButton && (
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
