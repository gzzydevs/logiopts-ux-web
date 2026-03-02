import type { KnownButton, ButtonConfig, SolaarAction, GestureDirection, SystemAction } from '../types';
import ActionPicker from './ActionPicker';

const GESTURE_DIRS: GestureDirection[] = ['None', 'Up', 'Down', 'Left', 'Right'];
const DIR_LABELS: Record<GestureDirection, string> = {
  None: '🖱️ Click',
  Up: '⬆️ Up',
  Down: '⬇️ Down',
  Left: '⬅️ Left',
  Right: '➡️ Right',
};
const NONE_ACTION: SolaarAction = { type: 'None' };

interface ButtonConfigPanelProps {
  button: KnownButton;
  config: ButtonConfig;
  onChange: (config: ButtonConfig) => void;
  systemActions: SystemAction[];
}

export default function ButtonConfigPanel({ button, config, onChange, systemActions }: ButtonConfigPanelProps) {
  const canGesture = button.divertable && button.rawXy;

  function setGestureMode(gestureMode: boolean) {
    onChange({ ...config, gestureMode });
  }

  function setGestureAction(dir: GestureDirection, action: SolaarAction) {
    onChange({
      ...config,
      gestures: { ...config.gestures, [dir]: action },
    });
  }

  function setSimpleAction(action: SolaarAction) {
    onChange({ ...config, simpleAction: action });
  }

  return (
    <div className="button-config">
      <div className="button-config-header">
        <h3>{button.name}</h3>
        <span className="cid-badge">CID {button.cid}</span>
        <div className="button-flags">
          {button.divertable && <span className="flag">Divertable</span>}
          {button.rawXy && <span className="flag">Raw XY</span>}
          {button.reprogrammable && <span className="flag">Reprog</span>}
        </div>
      </div>

      {!button.divertable ? (
        <p className="hint">This button cannot be diverted (reconfigured).</p>
      ) : (
        <>
          {/* Mode toggle */}
          {canGesture && (
            <div className="mode-toggle">
              <label>
                <input
                  type="radio"
                  checked={!config.gestureMode}
                  onChange={() => setGestureMode(false)}
                />
                Simple (click action)
              </label>
              <label>
                <input
                  type="radio"
                  checked={config.gestureMode}
                  onChange={() => setGestureMode(true)}
                />
                Mouse Gestures (5 directions)
              </label>
            </div>
          )}

          {config.gestureMode && canGesture ? (
            /* Gesture grid */
            <div className="gesture-grid">
              {GESTURE_DIRS.map(dir => (
                <div key={dir} className={`gesture-slot gesture-${dir.toLowerCase()}`}>
                  <ActionPicker
                    label={DIR_LABELS[dir]}
                    value={config.gestures[dir] || NONE_ACTION}
                    onChange={action => setGestureAction(dir, action)}
                    systemActions={systemActions}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Simple action */
            <ActionPicker
              label="Action"
              value={config.simpleAction}
              onChange={setSimpleAction}
              systemActions={systemActions}
            />
          )}
        </>
      )}
    </div>
  );
}
