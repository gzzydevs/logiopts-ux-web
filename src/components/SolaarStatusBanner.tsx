import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SolaarStatusBanner.css';

interface SolaarBannerStatus {
  running: boolean;
  installed: boolean;
}

export const SolaarStatusBanner: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SolaarBannerStatus | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSolaarStatus(setStatus);
    }
    // In browser mode this banner is not shown (no Electron IPC)
  }, []);

  // Don't render if not in Electron, or if status is unknown, or if everything is fine
  if (!window.electronAPI || !status) return null;
  if (status.installed && status.running) return null;

  if (!status.installed) {
    return (
      <div className="solaar-banner solaar-banner--error">
        <span>⚠️ {t('solaar.not_installed', 'Solaar not detected on the system. Is it installed?')}</span>
        <a
          href="https://github.com/pwr-Solaar/Solaar"
          target="_blank"
          rel="noopener noreferrer"
          className="solaar-banner-link"
        >
          {t('solaar.install_instructions', 'Installation instructions')}
        </a>
      </div>
    );
  }

  return (
    <div className="solaar-banner solaar-banner--warning">
      <span>⚡ {t('solaar.not_running', 'Solaar is not active.')}</span>
      <button
        className="solaar-banner-btn"
        onClick={() => window.electronAPI?.startSolaar()}
      >
        {t('solaar.start', 'Start Solaar')}
      </button>
    </div>
  );
};
