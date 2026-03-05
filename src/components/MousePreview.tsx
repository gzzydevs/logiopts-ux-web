import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ActionConfigurator } from './ActionConfigurator';
import classNames from 'classnames';
import './MousePreview.css';

// SVG Placeholder for a generic mouse if image not provided
const GenericMouseSVG = () => (
    <svg viewBox="0 0 200 350" fill="none" xmlns="http://www.w3.org/2000/svg" className="mouse-img">
        <rect x="50" y="20" width="100" height="310" rx="50" fill="#1e1f26" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
        <path d="M50 120 Q100 150 150 120" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" fill="none" />
        <rect x="90" y="40" width="20" height="50" rx="10" fill="#ffffff" fillOpacity="0.05" />
        <path d="M100 20 L100 135" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
);

const MOUSE_NODES = [
    { id: 'forward', label: 'Forward Button', className: 'node-forward' },
    { id: 'back', label: 'Back Button', className: 'node-back' },
    { id: 'dpi', label: 'DPI Switch / Shift', className: 'node-shift' },
    { id: 'middle', label: 'Middle Click', className: 'node-middle' }
];

export const MousePreview: React.FC = () => {
    const { devices, selectedDeviceId } = useAppContext();
    const [activeNode, setActiveNode] = useState<string | null>(null);

    const device = devices.find(d => d.id === selectedDeviceId);

    return (
        <div className="preview-container">
            <div className="mouse-device">
                {device?.imageUrl ? (
                    <img src={device.imageUrl} alt={device.name} className="mouse-img" />
                ) : (
                    <GenericMouseSVG />
                )}

                {MOUSE_NODES.map(node => (
                    <div
                        key={node.id}
                        className={classNames('node', node.className, { active: activeNode === node.id })}
                        onClick={() => setActiveNode(node.id)}
                    >
                        <div className="node-label-container">
                            <div className="node-label">{node.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {activeNode && (
                <ActionConfigurator
                    buttonId={activeNode}
                    buttonLabel={MOUSE_NODES.find(n => n.id === activeNode)?.label || ''}
                    onClose={() => setActiveNode(null)}
                />
            )}
        </div>
    );
};
