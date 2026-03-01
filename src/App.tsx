import { useState, useEffect, useCallback } from 'react';
import type { KnownDevice, SystemAction, ButtonConfig, Profile } from './types';
import { getDevice, getSystemActions, applyConfig, resetConfig } from './hooks/useApi';
import MouseView from './components/MouseView';
import ButtonConfigPanel from './components/ButtonConfig';
import ProfileManager from './components/ProfileManager';

export default function App() {
  const [device, setDevice] = useState<KnownDevice | null>(null);
  const [systemActions, setSystemActions] = useState<SystemAction[]>([]);
  const [buttonConfigs, setButtonConfigs] = useState<ButtonConfig[]>([]);
  const [selectedCid, setSelectedCid] = useState<number | null>(null);
  const [dpi, setDpi] = useState(2400);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDevice(), getSystemActions()])
      .then(([dev, sa]) => {
        setDevice(dev);
        setSystemActions(sa);
        setLoading(false);
      })
      .catch((err) => { setStatus(`Error: ${err.message}`); setLoading(false); });
  }, []);

  const updateButton = useCallback((cfg: ButtonConfig) => {
    setButtonConfigs((prev) => {
      const idx = prev.findIndex((c) => c.cid === cfg.cid);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = cfg;
        return next;
      }
      return [...prev, cfg];
    });
  }, []);

  const handleApply = async () => {
    if (!device) return;
    setStatus('Applying...');
    try {
      // Filter out None actions
      const activeButtons = buttonConfigs.filter((b) => b.action.type !== 'None');
      await applyConfig({
        devices: [{
          name: device.logidName,
          dpi,
          buttons: activeButtons,
        }],
      });
      setStatus('Applied!');
      setTimeout(() => setStatus(''), 3000);
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const handleReset = async () => {
    if (!device) return;
    if (!confirm('Reset all button configs to factory defaults?')) return;
    setStatus('Resetting...');
    try {
      await resetConfig(device.logidName, dpi);
      setButtonConfigs([]);
      setSelectedCid(null);
      setStatus('Reset to defaults!');
      setTimeout(() => setStatus(''), 3000);
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  };

  const handleLoadProfile = (profile: Profile) => {
    setButtonConfigs(profile.buttons);
    if (profile.dpi) setDpi(profile.dpi);
    setStatus(`Loaded profile: ${profile.name}`);
    setTimeout(() => setStatus(''), 3000);
  };

  const selectedButton = device?.buttons.find((b) => b.cid === selectedCid) ?? null;

  if (loading) return <div className="loading">Loading...</div>;
  if (!device) return <div className="loading">Device not found</div>;

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-area">
          <h1>🖱 LogiTux</h1>
          <h2>{device.displayName} Configuration</h2>
        </div>
        <div className="actions">
          <div className="dpi-control">
            <label>DPI:</label>
            <input
              type="number"
              className="text-input dpi-input"
              value={dpi}
              onChange={(e) => setDpi(Math.max(device.minDpi, Math.min(device.maxDpi, parseInt(e.target.value) || device.minDpi)))}
              min={device.minDpi}
              max={device.maxDpi}
              step={device.dpiStep}
            />
          </div>
          <button className="btn-primary" onClick={handleApply}>Apply</button>
          <button className="btn-reset" onClick={handleReset}>Reset</button>
          {status && <span className="status">{status}</span>}
        </div>
      </header>

      <div className="main-grid">
        <div className="left-col">
          <MouseView
            buttons={device.buttons}
            configs={buttonConfigs}
            selectedCid={selectedCid}
            onSelectButton={setSelectedCid}
          />
          <ProfileManager
            deviceName={device.logidName}
            dpi={dpi}
            buttons={buttonConfigs}
            onLoad={handleLoadProfile}
          />
        </div>
        <div className="right-col">
          {selectedButton ? (
            <ButtonConfigPanel
              button={selectedButton}
              config={buttonConfigs.find((c) => c.cid === selectedButton.cid)}
              onChange={updateButton}
              systemActions={systemActions}
            />
          ) : (
            <div className="card placeholder">
              <p>Select a button on the mouse to configure it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
