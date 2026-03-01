import type { Action, SystemAction } from '../types';
import KeyCapture from './KeyCapture';

interface ActionPickerProps {
  action: Action;
  onChange: (action: Action) => void;
  systemActions: SystemAction[];
}

type ActionType = 'None' | 'Keypress' | 'SystemAction' | 'CycleDPI' | 'ChangeDPI';

function getActionType(action: Action): ActionType {
  if (action.type === 'Keypress') return 'Keypress';
  if (action.type === 'CycleDPI') return 'CycleDPI';
  if (action.type === 'ChangeDPI') return 'ChangeDPI';
  return 'None';
}

export default function ActionPicker({ action, onChange, systemActions }: ActionPickerProps) {
  const currentType = getActionType(action);

  const actionTypes: { id: ActionType; label: string }[] = [
    { id: 'None', label: 'None' },
    { id: 'Keypress', label: 'Shortcut' },
    { id: 'SystemAction', label: 'System' },
    { id: 'CycleDPI', label: 'Cycle DPI' },
    { id: 'ChangeDPI', label: 'DPI +/-' },
  ];

  const setType = (type: ActionType) => {
    switch (type) {
      case 'None': onChange({ type: 'None' }); break;
      case 'Keypress': onChange({ type: 'Keypress', keys: [] }); break;
      case 'SystemAction':
        if (systemActions.length > 0) onChange({ type: 'Keypress', keys: systemActions[0].keys });
        break;
      case 'CycleDPI': onChange({ type: 'CycleDPI', dpis: [800, 1600, 2400] }); break;
      case 'ChangeDPI': onChange({ type: 'ChangeDPI', inc: 200 }); break;
    }
  };

  // Detect if current Keypress matches a system action
  const matchedSA = action.type === 'Keypress'
    ? systemActions.find((sa) => JSON.stringify(sa.keys) === JSON.stringify(action.keys))
    : undefined;

  const showSA = currentType === 'SystemAction' || !!matchedSA;

  return (
    <div className="action-picker">
      <h3>Action Type</h3>
      <div className="action-types">
        {actionTypes.map((at) => (
          <button
            key={at.id}
            className={`action-type-btn ${
              (at.id === currentType || (at.id === 'SystemAction' && matchedSA)) ? 'selected' : ''
            }`}
            onClick={() => setType(at.id)}
          >
            {at.label}
          </button>
        ))}
      </div>

      {currentType === 'Keypress' && !matchedSA && action.type === 'Keypress' && (
        <div>
          <h3>Keyboard Shortcut</h3>
          <KeyCapture keys={action.keys} onChange={(keys) => onChange({ type: 'Keypress', keys })} />
        </div>
      )}

      {showSA && (
        <div>
          <h3>System Action</h3>
          <div className="system-actions-grid">
            {systemActions.map((sa) => (
              <button
                key={sa.id}
                className={`system-action-btn ${matchedSA?.id === sa.id ? 'selected' : ''}`}
                onClick={() => onChange({ type: 'Keypress', keys: sa.keys })}
                title={sa.description}
              >
                {sa.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {action.type === 'CycleDPI' && (
        <div>
          <h3>DPI Values</h3>
          <input
            type="text"
            className="text-input"
            value={action.dpis.join(', ')}
            onChange={(e) => {
              const dpis = e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
              if (dpis.length > 0) onChange({ type: 'CycleDPI', dpis });
            }}
            placeholder="800, 1600, 2400"
          />
          <p className="hint">Comma-separated DPI values to cycle through</p>
        </div>
      )}

      {action.type === 'ChangeDPI' && (
        <div>
          <h3>DPI Increment</h3>
          <input
            type="number"
            className="text-input"
            value={action.inc}
            onChange={(e) => {
              const inc = parseInt(e.target.value, 10);
              if (!isNaN(inc)) onChange({ type: 'ChangeDPI', inc });
            }}
            step={100}
          />
          <p className="hint">Positive = increase, negative = decrease</p>
        </div>
      )}
    </div>
  );
}
