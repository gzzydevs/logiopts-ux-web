import React, { useEffect, useState } from 'react';
import './SolaarStatusBanner.css';

interface SolaarStatusState {
  running: boolean;
  installed: boolean;
}

export const SolaarStatusBanner: React.FC = () => {
  const [status, setStatus] = useState<SolaarStatusState | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSolaarStatus(setStatus);
    } else {
      // Fallback HTTP poll for browser mode
      fetch('/api/device/status')
        .then(r => r.json())
        .then(d => {
          if (d.data) {
            setStatus({ running: d.data.running, installed: d.data.installed });
          }
        })
        .catch(() => { /* ignore — server may not expose this endpoint */ });
    }
  }, []);

  if (!status || (status.installed && status.running)) return null;

  if (!status.installed) {
    return (
      <div className="solaar-banner solaar-banner--error">
        <span>⚠️ Solaar no detectado en el sistema. ¿Está instalado?</span>
        <a
          href="https://github.com/pwr-Solaar/Solaar"
          target="_blank"
          rel="noopener noreferrer"
          className="solaar-banner__link"
        >
          Ver instrucciones
        </a>
      </div>
    );
  }

  return (
    <div className="solaar-banner solaar-banner--warning">
      <span>⚡ Solaar no está activo.</span>
      {window.electronAPI && (
        <button
          className="solaar-banner__btn"
          onClick={() => window.electronAPI?.startSolaar()}
        >
          Iniciar Solaar
        </button>
      )}
    </div>
  );
};
