import { useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { Topbar } from './components/Topbar';
import { MousePreview } from './components/MousePreview';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastContainer } from './components/Toast';
import './App.css';

export default function App() {
  const { appStatus, bootstrap } = useAppContext();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <div className="app">
      <Topbar />

      <div className="app-body">
        {appStatus === 'loading' && (
          <div className="app-state-screen">
            <div className="spinner" />
            <p>Detecting device...</p>
          </div>
        )}

        {appStatus === 'error' && (
          <div className="app-state-screen app-state-error">
            <p>⚠️ Failed to connect to server. Is the backend running?</p>
            <button className="btn btn-primary" onClick={bootstrap}>Retry</button>
          </div>
        )}

        {appStatus === 'no-device' && (
          <div className="app-state-screen">
            <p>No Logitech device found. Make sure Solaar is installed and a device is connected.</p>
            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Use the "Detect Device" button in the toolbar.</p>
          </div>
        )}

        {appStatus === 'connected' && (
          <div className="app-connected-layout">
            <MousePreview />
            <SettingsPanel />
          </div>
        )}
      </div>

      <ToastContainer />
    </div>
  );
}
