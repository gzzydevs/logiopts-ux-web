import { useState, useEffect, useCallback } from 'react';
import type { KnownDevice, ButtonConfig, SolaarAction, GestureDirection, SystemAction, SolaarConfig, Profile } from './types';
import { fetchDevice, fetchConfig, fetchSystemActions, applyConfig, resetConfig, DeviceResponse } from './hooks/useApi';
import MouseView from './components/MouseView';
import ButtonConfigPanel from './components/ButtonConfig';
import ProfileManager from './components/ProfileManager';

const NONE_ACTION: SolaarAction = { type: 'None' };
const DEFAULT_GESTURES: Record<GestureDirection, SolaarAction> = {
  None: NONE_ACTION,
  Up: NONE_ACTION,
  Down: NONE_ACTION,
  Left: NONE_ACTION,
  Right: NONE_ACTION,
};

function buildDefaultButtonConfig(cid: number): ButtonConfig {
  return {
    cid,
    gestureMode: false,
    gestures: { ...DEFAULT_GESTURES },
    simpleAction: NONE_ACTION,
  };
}

export default function App() {
  // ─── State ───────────────────────────────────────────────────────────
  const [device, setDevice] = useState<KnownDevice | null>(null);
  const [deviceMeta, setDeviceMeta] = useState<Pick<DeviceResponse, 'dpi' | 'divertKeys' | 'installType' | 'configDir'> | null>(null);
  const [dpi, setDpi] = useState(2400);
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);
  const [selectedCid, setSelectedCid] = useState<number | null>(null);
  const [systemActions, setSystemActions] = useState<SystemAction[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'applying' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // ─── Load device & config ────────────────────────────────────────────
  const loadDevice = useCallback(async () => {
    setStatus('loading');
    setMessage('Detecting device…');
    try {
      const [devResp, sysActions] = await Promise.all([
        fetchDevice(),
        fetchSystemActions(),
      ]);

      setDevice(devResp.device);
      setDeviceMeta({
        dpi: devResp.dpi,
        divertKeys: devResp.divertKeys,
        installType: devResp.installType,
        configDir: devResp.configDir,
      });
      setDpi(devResp.dpi);
      setSystemActions(sysActions);

      // Build initial button configs
      const btnConfigs = devResp.device.buttons.map(b => buildDefaultButtonConfig(b.cid));

      // Check for gesture-mode buttons from divert-keys
      for (const btn of btnConfigs) {
        const divertVal = devResp.divertKeys[String(btn.cid)];
        if (divertVal === 2) {
          btn.gestureMode = true;
        }
      }

      setButtons(btnConfigs);
      if (devResp.device.buttons.length > 0) {
        setSelectedCid(devResp.device.buttons[0].cid);
      }

      // Try to load existing rules
      try {
        const configResp = await fetchConfig();
        if (configResp.rules.length > 0) {
          // Merge existing rules into button configs
          for (const rule of configResp.rules) {
            if (rule.condition.type === 'MouseGesture') {
              // Find the button in gesture mode
              const gestureBtn = btnConfigs.find(b => b.gestureMode);
              if (gestureBtn) {
                const dirs = rule.condition.directions;
                let dir: GestureDirection = 'None'; // click
                if (dirs.length > 0) {
                  const dirMap: Record<string, GestureDirection> = {
                    'Mouse Up': 'Up',
                    'Mouse Down': 'Down',
                    'Mouse Left': 'Left',
                    'Mouse Right': 'Right',
                  };
                  dir = dirMap[dirs[0]] || 'None';
                }
                gestureBtn.gestures[dir] = rule.action;
              }
            }
          }
          setButtons([...btnConfigs]);
        }
      } catch { /* no existing config, that's fine */ }

      setStatus('idle');
      setMessage('');
      setHasChanges(false);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to detect device');
    }
  }, []);

  useEffect(() => { loadDevice(); }, [loadDevice]);

  // ─── Button config change handler ────────────────────────────────────
  function handleButtonChange(updated: ButtonConfig) {
    setButtons(prev => prev.map(b => b.cid === updated.cid ? updated : b));
    setHasChanges(true);
  }

  // ─── Apply config ────────────────────────────────────────────────────
  async function handleApply() {
    if (!device || !deviceMeta) return;
    setStatus('applying');
    setMessage('Applying configuration…');

    try {
      // Build divert-keys map
      const divertKeys: Record<number, 0 | 1 | 2> = {};
      for (const btn of buttons) {
        if (btn.gestureMode) {
          divertKeys[btn.cid] = 2; // Mouse Gestures
        } else if (btn.simpleAction.type !== 'None') {
          divertKeys[btn.cid] = 1; // Diverted
        } else {
          divertKeys[btn.cid] = 0; // Regular
        }
      }

      const solaarConfig: SolaarConfig = {
        deviceName: device.solaarName,
        unitId: device.unitId,
        dpi,
        divertKeys,
        rules: [], // rules are generated server-side from buttons
      };

      await applyConfig(solaarConfig, buttons);
      setStatus('idle');
      setMessage('✅ Configuration applied!');
      setHasChanges(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Apply failed');
    }
  }

  // ─── Reset config ───────────────────────────────────────────────────
  async function handleReset() {
    setStatus('applying');
    setMessage('Resetting configuration…');
    try {
      await resetConfig();
      await loadDevice();
      setMessage('✅ Configuration reset!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Reset failed');
    }
  }

  // ─── Profile handling ───────────────────────────────────────────────
  function handleLoadProfile(profile: Profile) {
    setButtons(profile.buttons);
    if (profile.dpi) setDpi(profile.dpi);
    setHasChanges(true);
    setMessage(`Loaded profile "${profile.name}"`);
    setTimeout(() => setMessage(''), 3000);
  }

  // ─── Selected button ────────────────────────────────────────────────
  const selectedButton = device?.buttons.find(b => b.cid === selectedCid);
  const selectedConfig = buttons.find(b => b.cid === selectedCid);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1>🖱️ LogiTux</h1>
        <span className="subtitle">Solaar Mouse Configuration</span>
      </header>

      {message && (
        <div className={`status-bar ${status}`}>
          {message}
        </div>
      )}

      <div className="app-content">
        {/* Left panel: mouse + DPI */}
        <aside className="left-panel">
          <MouseView
            device={device}
            selectedCid={selectedCid}
            onSelectButton={setSelectedCid}
          />

          {device && (
            <div className="dpi-control">
              <label>
                DPI: <strong>{dpi}</strong>
              </label>
              <input
                type="range"
                min={device.minDpi}
                max={device.maxDpi}
                step={device.dpiStep}
                value={dpi}
                onChange={e => { setDpi(parseInt(e.target.value, 10)); setHasChanges(true); }}
              />
            </div>
          )}

          {/* Button list */}
          {device && (
            <div className="button-list">
              {device.buttons.map(btn => {
                const conf = buttons.find(b => b.cid === btn.cid);
                const isActive = conf && (conf.gestureMode || conf.simpleAction.type !== 'None');
                return (
                  <button
                    key={btn.cid}
                    className={`btn-list-item ${btn.cid === selectedCid ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedCid(btn.cid)}
                  >
                    <span className="btn-name">{btn.name}</span>
                    {isActive && <span className="active-dot">●</span>}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right panel: button config */}
        <main className="right-panel">
          {selectedButton && selectedConfig ? (
            <ButtonConfigPanel
              button={selectedButton}
              config={selectedConfig}
              onChange={handleButtonChange}
              systemActions={systemActions}
            />
          ) : (
            <div className="empty-state">
              {status === 'loading' ? (
                <p>Detecting device…</p>
              ) : status === 'error' ? (
                <div>
                  <p>⚠️ {message}</p>
                  <button className="btn btn-primary" onClick={loadDevice}>Retry</button>
                </div>
              ) : (
                <p>Select a button to configure</p>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer actions */}
      <footer className="app-footer">
        <div className="footer-left">
          {device && (
            <ProfileManager
              deviceName={device.solaarName}
              currentDpi={dpi}
              currentButtons={buttons}
              onLoadProfile={handleLoadProfile}
            />
          )}
        </div>
        <div className="footer-right">
          <button
            className="btn btn-danger"
            onClick={handleReset}
            disabled={status === 'applying'}
          >
            Reset
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={status === 'applying' || !hasChanges}
          >
            {status === 'applying' ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </footer>
    </div>
  );
}
