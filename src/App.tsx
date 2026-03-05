import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from './context/AppContext';
import { Topbar } from './components/Topbar';
import { SettingsPanel } from './components/SettingsPanel';
import { MousePreview } from './components/MousePreview';
import { ToastContainer } from './components/Toast';
import './App.css';

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const { appStatus, bootstrap, detectDevice } = useAppContext();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <div className="app-container">
      <Topbar />
      <div className="main-content">
        <SettingsPanel />
        <main className="workspace">
          {appStatus === 'loading' && (
            <div className="loading-solaar">
              <div className="spinner"></div>
              <h2>{t('app.loading_solaar')}</h2>
            </div>
          )}
          {appStatus === 'error' && (
            <div className="loading-solaar">
              <h2>Connection Error</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Could not connect to the backend server.
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => bootstrap()}
              >
                Retry
              </button>
            </div>
          )}
          {appStatus === 'no-device' && (
            <div className="loading-solaar">
              <h2>No Device Detected</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Connect your Logitech mouse and make sure Solaar is running.
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
                onClick={detectDevice}
              >
                🔍 Detect Device
              </button>
            </div>
          )}
          {appStatus === 'connected' && (
            <MousePreview />
          )}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

export default AppContent;
