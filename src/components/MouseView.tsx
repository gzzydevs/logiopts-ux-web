import type { KnownDevice, KnownButton } from '../types';

const BUTTON_POSITIONS: Record<string, { x: number; y: number }> = {
  left:       { x: 55,  y: 80 },
  right:      { x: 175, y: 80 },
  middle:     { x: 115, y: 55 },
  back:       { x: 30,  y: 150 },
  forward:    { x: 30,  y: 120 },
  dpiSwitch:  { x: 115, y: 140 },
  scrollMode: { x: 115, y: 30 },
  scrollLeft: { x: 85,  y: 40 },
  scrollRight:{ x: 145, y: 40 },
};

interface MouseViewProps {
  device: KnownDevice | null;
  selectedCid: number | null;
  onSelectButton: (cid: number) => void;
}

export default function MouseView({ device, selectedCid, onSelectButton }: MouseViewProps) {
  if (!device) {
    return (
      <div className="mouse-view empty">
        <p>No device detected</p>
      </div>
    );
  }

  return (
    <div className="mouse-view">
      {/* Simple SVG mouse outline */}
      <svg viewBox="0 0 230 300" className="mouse-svg">
        {/* Body */}
        <rect x="30" y="20" width="170" height="260" rx="85" ry="85" className="mouse-body" />
        {/* Divider */}
        <line x1="115" y1="20" x2="115" y2="140" className="mouse-divider" />
        {/* Scroll wheel */}
        <rect x="105" y="40" width="20" height="30" rx="10" className="mouse-wheel" />

        {/* Button hotspots */}
        {device.buttons.map(btn => {
          const pos = BUTTON_POSITIONS[btn.position];
          if (!pos) return null;
          const isSelected = btn.cid === selectedCid;
          return (
            <g key={btn.cid} onClick={() => onSelectButton(btn.cid)} className="mouse-btn-group">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={18}
                className={`mouse-btn-circle ${isSelected ? 'selected' : ''} ${btn.divertable ? 'divertable' : 'locked'}`}
              />
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                className="mouse-btn-label"
              >
                {btn.name.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Device info */}
      <div className="device-info">
        <h3>{device.displayName}</h3>
        <div className="device-meta">
          {device.battery >= 0 && (
            <span className="battery">🔋 {device.battery}%</span>
          )}
          <span className="unit-id">ID: {device.unitId}</span>
        </div>
      </div>
    </div>
  );
}
