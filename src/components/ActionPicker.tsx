import { useState } from 'react';
import type { SolaarAction, SystemAction } from '../types';
import KeyCapture, { displayKeysym } from './KeyCapture';
import ComboBuilder from './ComboBuilder';

interface ActionPickerProps {
  value: SolaarAction;
  onChange: (action: SolaarAction) => void;
  systemActions: SystemAction[];
  label?: string;
}

export default function ActionPicker({ value, onChange, systemActions, label }: ActionPickerProps) {
  const [keyCapOpen, setKeyCapOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [cmdInput, setCmdInput] = useState(
    value.type === 'Execute' ? value.command.join(' ') : ''
  );

  const actionType = value.type;

  function handleTypeChange(type: SolaarAction['type']) {
    switch (type) {
      case 'None':
        onChange({ type: 'None' });
        break;
      case 'KeyPress':
        onChange({ type: 'KeyPress', keys: [] });
        break;
      case 'MouseClick':
        onChange({ type: 'MouseClick', button: 'middle', count: 'click' });
        break;
      case 'MouseScroll':
        onChange({ type: 'MouseScroll', horizontal: 0, vertical: 1 });
        break;
      case 'Execute':
        onChange({ type: 'Execute', command: [] });
        setCmdInput('');
        break;
    }
  }

  function handleSystemAction(id: string) {
    const sa = systemActions.find(a => a.id === id);
    if (sa) onChange(sa.action);
  }

  function handleKeyCaptureConfirm(keys: string[]) {
    setKeyCapOpen(false);
    onChange({ type: 'KeyPress', keys });
  }

  function handleComboConfirm(keys: string[]) {
    setComboOpen(false);
    onChange({ type: 'KeyPress', keys });
  }

  function handleCommandSubmit() {
    const parts = cmdInput.trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      onChange({ type: 'Execute', command: parts });
    }
  }

  return (
    <div className="action-picker">
      {label && <label className="action-label">{label}</label>}

      {/* Action type selector */}
      <div className="action-type-row">
        <select
          value={actionType}
          onChange={e => handleTypeChange(e.target.value as SolaarAction['type'])}
        >
          <option value="None">None</option>
          <option value="KeyPress">Key Press</option>
          <option value="MouseClick">Mouse Click</option>
          <option value="MouseScroll">Mouse Scroll</option>
          <option value="Execute">Execute Command</option>
        </select>

        {/* Quick system action dropdown */}
        <select
          value=""
          onChange={e => handleSystemAction(e.target.value)}
          className="system-action-select"
        >
          <option value="">Quick Actions…</option>
          {(['volume', 'media', 'brightness', 'system'] as const).map(cat => (
            <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
              {systemActions.filter(a => a.category === cat).map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Type-specific controls */}
      {actionType === 'KeyPress' && (
        <div className="action-detail">
          <div className="action-key-buttons">
            <button className="btn btn-small" onClick={() => setKeyCapOpen(true)}>
              {value.type === 'KeyPress' && value.keys.length > 0
                ? value.keys.map(displayKeysym).join(' + ')
                : 'Capture Keys…'}
            </button>
            <button className="btn btn-small btn-secondary" onClick={() => setComboOpen(true)}>
              🎹 Combo Builder
            </button>
          </div>
          <KeyCapture
            open={keyCapOpen}
            currentKeys={value.type === 'KeyPress' ? value.keys : []}
            onConfirm={handleKeyCaptureConfirm}
            onCancel={() => setKeyCapOpen(false)}
          />
          <ComboBuilder
            open={comboOpen}
            currentKeys={value.type === 'KeyPress' ? value.keys : []}
            onConfirm={handleComboConfirm}
            onCancel={() => setComboOpen(false)}
          />
        </div>
      )}

      {actionType === 'MouseClick' && value.type === 'MouseClick' && (
        <div className="action-detail">
          <select
            value={value.button}
            onChange={e => onChange({ ...value, button: e.target.value as 'left' | 'middle' | 'right' })}
          >
            <option value="left">Left</option>
            <option value="middle">Middle</option>
            <option value="right">Right</option>
          </select>
          <select
            value={String(value.count)}
            onChange={e => {
              const v = e.target.value;
              onChange({ ...value, count: v === 'click' ? 'click' : parseInt(v, 10) });
            }}
          >
            <option value="click">Click</option>
            <option value="2">Double Click</option>
            <option value="3">Triple Click</option>
          </select>
        </div>
      )}

      {actionType === 'MouseScroll' && value.type === 'MouseScroll' && (
        <div className="action-detail">
          <label>
            Vertical:
            <input
              type="number"
              value={value.vertical}
              onChange={e => onChange({ ...value, vertical: parseInt(e.target.value, 10) || 0 })}
              min={-10} max={10}
            />
          </label>
          <label>
            Horizontal:
            <input
              type="number"
              value={value.horizontal}
              onChange={e => onChange({ ...value, horizontal: parseInt(e.target.value, 10) || 0 })}
              min={-10} max={10}
            />
          </label>
        </div>
      )}

      {actionType === 'Execute' && (
        <div className="action-detail">
          <input
            type="text"
            value={cmdInput}
            onChange={e => setCmdInput(e.target.value)}
            onBlur={handleCommandSubmit}
            onKeyDown={e => { if (e.key === 'Enter') handleCommandSubmit(); }}
            placeholder="e.g. pactl set-sink-volume @DEFAULT_SINK@ +5%"
            className="cmd-input"
          />
        </div>
      )}

      {/* Current value display */}
      {actionType !== 'None' && (
        <div className="action-preview">
          {formatAction(value)}
        </div>
      )}
    </div>
  );
}

function formatAction(a: SolaarAction): string {
  switch (a.type) {
    case 'None': return '';
    case 'KeyPress': return `Keys: ${a.keys.map(displayKeysym).join(' + ')}`;
    case 'MouseClick': return `Mouse ${a.button} ${a.count === 'click' ? 'click' : `×${a.count}`}`;
    case 'MouseScroll': return `Scroll: H=${a.horizontal} V=${a.vertical}`;
    case 'Execute': return `Run: ${a.command.join(' ')}`;
    case 'RunScript': return `Script: ${a.script}`;
  }
}
