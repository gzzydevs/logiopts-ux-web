import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { saveDeviceLayout } from '../hooks/useApi';
import { PenLine, X, Save, Loader2 } from 'lucide-react';
import classNames from 'classnames';
import './LayoutEditor.css';

const GenericMouseSVG = () => (
    <svg viewBox="0 0 200 350" fill="none" xmlns="http://www.w3.org/2000/svg" className="mouse-img">
        <rect x="50" y="20" width="100" height="310" rx="50" fill="#1e1f26" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
        <path d="M50 120 Q100 150 150 120" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" fill="none" />
        <rect x="90" y="40" width="20" height="50" rx="10" fill="#ffffff" fillOpacity="0.05" />
        <path d="M100 20 L100 135" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
);

/** Factor for rounding to 1 decimal place */
const POSITION_PRECISION = 10;

interface LayoutEditorProps {
    onExit: () => void;
}

export const LayoutEditor: React.FC<LayoutEditorProps> = ({ onExit }) => {
    const { device, addToast, bootstrap } = useAppContext();
    const canvasRef = useRef<HTMLDivElement>(null);
    const [draggingCid, setDraggingCid] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Build initial draft from existing button layout positions
    const [draftLayout, setDraftLayout] = useState<Record<number, { x: number; y: number }>>(() => {
        if (!device) return {};
        const initial: Record<number, { x: number; y: number }> = {};
        for (const btn of device.buttons) {
            if (btn.layoutX !== undefined && btn.layoutY !== undefined) {
                initial[btn.cid] = { x: btn.layoutX, y: btn.layoutY };
            }
        }
        return initial;
    });

    const handleDragStart = useCallback((e: React.DragEvent, cid: number) => {
        setDraggingCid(cid);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(cid));

        // Create a small transparent drag image so the default ghost doesn't obscure
        const ghost = document.createElement('div');
        ghost.style.width = '24px';
        ghost.style.height = '24px';
        ghost.style.borderRadius = '50%';
        ghost.style.background = 'rgba(130, 170, 255, 0.6)';
        ghost.style.position = 'absolute';
        ghost.style.top = '-100px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 12, 12);
        setTimeout(() => document.body.removeChild(ghost), 0);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const cidStr = e.dataTransfer.getData('text/plain');
        const cid = parseInt(cidStr, 10);
        if (isNaN(cid)) return;

        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Clamp to 0..100
        const clampedX = Math.max(0, Math.min(100, x));
        const clampedY = Math.max(0, Math.min(100, y));

        setDraftLayout(prev => ({
            ...prev,
            [cid]: {
                x: Math.round(clampedX * POSITION_PRECISION) / POSITION_PRECISION,
                y: Math.round(clampedY * POSITION_PRECISION) / POSITION_PRECISION,
            },
        }));
        setDraggingCid(null);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggingCid(null);
    }, []);

    const handleSave = useCallback(async () => {
        if (!device) return;
        setSaving(true);
        try {
            await saveDeviceLayout(device.unitId, draftLayout);
            addToast({ type: 'success', message: 'Button layout saved!' });
            // Re-bootstrap to load updated device with new layout
            await bootstrap();
            onExit();
        } catch (err) {
            addToast({
                type: 'error',
                message: `Failed to save layout: ${err instanceof Error ? err.message : 'Unknown error'}`,
            });
        } finally {
            setSaving(false);
        }
    }, [device, draftLayout, addToast, bootstrap, onExit]);

    const handleCancel = useCallback(() => {
        onExit();
    }, [onExit]);

    if (!device) return null;

    // POSITION_CONFIG fallback (same as MousePreview)
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

    return (
        <div className="layout-editor-wrapper">
            <div className="layout-editor-banner">
                <span className="layout-edit-badge"><PenLine size={14} /> LAYOUT EDIT MODE</span>
                <span className="layout-edit-hint">Drag buttons to position them on the mouse</span>
            </div>

            <div className="layout-editor-canvas-area">
                <div
                    className="mouse-device layout-canvas"
                    ref={canvasRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <GenericMouseSVG />

                    {device.buttons.map(btn => {
                        const draftPos = draftLayout[btn.cid];
                        const hasLayout = draftPos !== undefined;
                        const hasSavedLayout = btn.layoutX !== undefined && btn.layoutY !== undefined;

                        const posConfig = POSITION_CONFIG[btn.position] || {
                            className: `node-pos-${btn.position}`,
                            labelSide: 'right' as const,
                        };

                        // In edit mode: use draft position > saved position > CSS fallback
                        const inlineStyle = hasLayout
                            ? { top: `${draftPos.y}%`, left: `${draftPos.x}%` }
                            : hasSavedLayout
                                ? { top: `${btn.layoutY}%`, left: `${btn.layoutX}%` }
                                : undefined;

                        const labelSide = hasLayout
                            ? (draftPos.x < 50 ? 'right' : 'left')
                            : hasSavedLayout
                                ? (btn.layoutX! < 50 ? 'right' : 'left')
                                : posConfig.labelSide;

                        return (
                            <div
                                key={btn.cid}
                                className={classNames('node', 'layout-node', {
                                    [posConfig.className]: !hasLayout && !hasSavedLayout,
                                    'layout-dragging': draggingCid === btn.cid,
                                    'layout-positioned': hasLayout || hasSavedLayout,
                                })}
                                style={inlineStyle}
                                draggable
                                onDragStart={(e) => handleDragStart(e, btn.cid)}
                                onDragEnd={handleDragEnd}
                                title={`Drag to reposition: ${btn.name}`}
                            >
                                <div className={classNames('node-label-container', `label-${labelSide}`)}>
                                    <div className="node-label">{btn.name}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="layout-editor-actions">
                <button
                    className="layout-btn layout-cancel-btn"
                    onClick={handleCancel}
                    disabled={saving}
                >
                    <X size={16} /> Cancel
                </button>
                <button
                    className="layout-btn layout-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save Layout'}
                </button>
            </div>
        </div>
    );
};
