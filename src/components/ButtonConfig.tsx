import { useState } from 'react';
import type { KnownButton, Action, GestureConfig, SystemAction, ButtonConfig } from '../types';
import ActionPicker from './ActionPicker';

interface ButtonConfigPanelProps {
  button: KnownButton;
  config: ButtonConfig | undefined;
  onChange: (config: ButtonConfig) => void;
  systemActions: SystemAction[];
}

const DIRECTIONS = ['None', 'Up', 'Down', 'Left', 'Right'] as const;
type Direction = (typeof DIRECTIONS)[number];

const DIR_LABELS: Record<Direction, string> = {
  None: '●', Up: '↑', Down: '↓', Left: '←', Right: '→',
};

/** Convert a ButtonConfig action into a map of direction → Action */
function actionToGestureMap(action: Action | undefined): Record<Direction, Action> {
  const map: Record<Direction, Action> = {
    None: { type: 'None' }, Up: { type: 'None' }, Down: { type: 'None' },
    Left: { type: 'None' }, Right: { type: 'None' },
  };
  if (!action) return map;
  if (action.type === 'Gestures') {
    for (const g of action.gestures) map[g.direction] = g.action;
  } else {
    map.None = action;
  }
  return map;
}

/** Convert gesture map back to a ButtonConfig action */
function gestureMapToAction(map: Record<Direction, Action>, supportsGestures: boolean): Action {
  const hasDirectional = DIRECTIONS.some((d) => d !== 'None' && map[d].type !== 'None');

  if (!hasDirectional || !supportsGestures) return map.None;

  // Build gestures — directional ones use OnInterval so they repeat while moving
  const gestures: GestureConfig[] = [];
  for (const dir of DIRECTIONS) {
    if (map[dir].type !== 'None') {
      const isDir = dir !== 'None';
      gestures.push({
        direction: dir,
        mode: isDir ? 'OnInterval' : 'OnRelease',
        threshold: isDir ? 50 : undefined,
        action: map[dir],
      });
    }
  }

  // Always include None so button click still works
  if (!gestures.some((g) => g.direction === 'None')) {
    gestures.unshift({ direction: 'None', mode: 'OnRelease', action: { type: 'None' } });
  }

  return { type: 'Gestures', gestures };
}

function describeAction(action: Action): string {
  switch (action.type) {
    case 'None': return '—';
    case 'Keypress': {
      const display: Record<string, string> = {
        KEY_LEFTCTRL: 'Ctrl', KEY_LEFTSHIFT: 'Shift', KEY_LEFTALT: 'Alt',
        KEY_LEFTMETA: 'Super', KEY_VOLUMEUP: 'Vol+', KEY_VOLUMEDOWN: 'Vol-',
        KEY_MUTE: 'Mute', KEY_PLAYPAUSE: '⏯', KEY_NEXTSONG: '⏭',
        KEY_PREVIOUSSONG: '⏮', KEY_HOMEPAGE: '🌐',
      };
      return action.keys.map((k) => display[k] ?? k.replace('KEY_', '')).join('+');
    }
    case 'CycleDPI': return `DPI ${action.dpis.join('/')}`;
    case 'ChangeDPI': return `DPI ${action.inc > 0 ? '+' : ''}${action.inc}`;
    case 'Gestures': return `${action.gestures.length} gestures`;
    default: return '?';
  }
}

export default function ButtonConfigPanel({
  button, config, onChange, systemActions,
}: ButtonConfigPanelProps) {
  const [selectedDir, setSelectedDir] = useState<Direction>('None');
  const gestureMap = actionToGestureMap(config?.action);

  const updateDirection = (dir: Direction, action: Action) => {
    const newMap = { ...gestureMap, [dir]: action };
    onChange({ cid: button.cid, action: gestureMapToAction(newMap, button.supportsGestures) });
  };

  if (!button.reprogrammable) {
    return (
      <div className="btn-config card">
        <div className="btn-config-header">
          <h3>{button.name}</h3>
          <span className="cid">CID: 0x{button.cid.toString(16).padStart(4, '0')}</span>
        </div>
        <p className="hint">This button cannot be remapped.</p>
      </div>
    );
  }

  return (
    <div className="btn-config card">
      <div className="btn-config-header">
        <h3>{button.name}</h3>
        <span className="cid">CID: 0x{button.cid.toString(16).padStart(4, '0')}</span>
      </div>

      {button.supportsGestures && (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>
            Hold button + move mouse to trigger directional actions (repeats while moving)
          </p>
          <div className="gesture-grid">
            {DIRECTIONS.map((dir) => {
              const act = gestureMap[dir];
              const hasAction = act.type !== 'None';
              return (
                <div
                  key={dir}
                  className={`gesture-slot ${selectedDir === dir ? 'active' : ''} ${hasAction ? 'has-action' : ''}`}
                  data-dir={dir}
                  onClick={() => setSelectedDir(dir)}
                >
                  <span className="dir-label">{dir === 'None' ? 'CLICK' : dir}</span>
                  <span className="action-label">
                    {DIR_LABELS[dir]} {hasAction ? describeAction(act) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ActionPicker
        action={gestureMap[selectedDir]}
        onChange={(action) => updateDirection(selectedDir, action)}
        systemActions={systemActions}
      />
    </div>
  );
}
