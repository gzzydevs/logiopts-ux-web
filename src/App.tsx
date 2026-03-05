import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from './context/AppContext';
import { Topbar } from './components/Topbar';
import { SettingsPanel } from './components/SettingsPanel';
import { MousePreview } from './components/MousePreview';
import './App.css';

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const { solaarStatus, setSolaarStatus, mocksMode } = useAppContext();

  useEffect(() => {
    if (mocksMode) {
      setSolaarStatus('connected');
      return;
    }

    setSolaarStatus('loading');
    const interval = setInterval(() => {
      // Simulate polling /api/solaar/status
      setSolaarStatus('connected');
    }, 2000);
    return () => clearInterval(interval);
  }, [mocksMode, setSolaarStatus]);

  return (
    <div className="app-container">
      <Topbar />
      <div className="main-content">
        <SettingsPanel />
        <main className="workspace">
          {solaarStatus === 'loading' && (
            <div className="loading-solaar">
              <div className="spinner"></div>
              <h2>{t('app.loading_solaar')}</h2>
            </div>
          )}
          {solaarStatus === 'connected' && (
            <MousePreview />
          )}
        </main>
      </div>
    </div>
  );
};

export default AppContent;
