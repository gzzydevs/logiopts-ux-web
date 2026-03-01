import type { KnownButton, ButtonConfig } from '../types';

interface MouseViewProps {
  buttons: KnownButton[];
  configs: ButtonConfig[];
  selectedCid: number | null;
  onSelectButton: (cid: number) => void;
}

export default function MouseView({ buttons, configs, selectedCid, onSelectButton }: MouseViewProps) {
  const isConfigured = (cid: number) =>
    configs.some((c) => c.cid === cid && c.action.type !== 'None');

  return (
    <div className="mouse-view card">
      <h3>Logitech Lift</h3>
      <div className="mouse-svg">
        <svg className="mouse-body" viewBox="0 0 220 340" fill="none">
          {/* Main body */}
          <path
            d="M50 30 C50 15, 70 5, 110 5 C150 5, 170 15, 170 30 L175 250 C175 310, 145 335, 110 335 C75 335, 45 310, 45 250 Z"
            fill="#2a2a3e" stroke="#3a3a5e" strokeWidth="2"
          />
          {/* Top button area */}
          <rect x="92" y="62" width="36" height="16" rx="4" fill="#252538" stroke="#3a3a5e" strokeWidth="1" />
          {/* Scroll wheel */}
          <rect x="100" y="80" width="20" height="40" rx="10" fill="#444" stroke="#555" strokeWidth="1" />
          {/* Left/right split */}
          <line x1="110" y1="5" x2="110" y2="140" stroke="#3a3a5e" strokeWidth="1" />
          {/* Side buttons area */}
          <rect x="38" y="145" width="12" height="100" rx="4" fill="#252538" stroke="#3a3a5e" strokeWidth="1" />
        </svg>

        {buttons.map((btn) => (
          <div
            key={btn.cid}
            className={`mouse-btn ${selectedCid === btn.cid ? 'active' : ''} ${isConfigured(btn.cid) ? 'configured' : ''}`}
            data-pos={btn.position}
            onClick={() => btn.reprogrammable && onSelectButton(btn.cid)}
            title={`${btn.name} (0x${btn.cid.toString(16)})`}
            style={{ opacity: btn.reprogrammable ? 1 : 0.4 }}
          >
            {btn.name}
          </div>
        ))}
      </div>
      <p className="hint" style={{ textAlign: 'center' }}>Click a button to configure it</p>
    </div>
  );
}
