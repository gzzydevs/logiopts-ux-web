# Frontend ↔ Backend Integration — Implementation Plan (updated Mar 5, 2026)

## CURRENT STATUS: ONE FILE REMAINING

The entire new frontend is already implemented except `src/App.tsx`, which is still the old version.
`src/main.tsx` already wraps in `<AppProvider>`, so all new components can access the context.

**Do not touch:** `AppContext.tsx`, `Topbar.tsx`, `Toast.tsx`, `MousePreview.tsx`, `ActionConfigurator.tsx`, `ActionPicker.tsx`, `SettingsPanel.tsx`, `useApi.ts`, `types.ts` — all already implemented and correct.

---

## [MODIFY] `src/App.tsx` — THE ONLY TASK

### What the old App.tsx does (DELETE all of this):

```
- Tiene su propio useState para device, buttons, dpi, systemActions, etc.
- Llama fetchDevice() + fetchConfig() directamente (sin pasar por AppContext)
- Renderiza <MouseView>, <ButtonConfigPanel>, <ProfileManager> (componentes viejos)
- Tiene handleApply() propio en el footer
- NO renderiza <Topbar>, <SettingsPanel>, <MousePreview>, ni <ToastContainer>
- NO usa useAppContext() en ningún momento
```

### New App.tsx — exact implementation:

```tsx
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
```

### Required CSS classes in `App.css`:

The existing `App.css` has styles for the old layout. Add the following (without removing existing styles):

```css
/* ─── App layout ─────────────────────────────────────────── */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.app-connected-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ─── State screens ──────────────────────────────────────── */
.app-state-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
}

.app-state-error {
  color: #ff6b6b;
}

/* ─── Spinner ────────────────────────────────────────────── */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

> **Note:** If `.app`, `.app-body` etc. already exist in `App.css`, update them instead of duplicating. The goal is a flex-column layout with `Topbar` at the top and the body below.

---

## Verification

### Tests (must not change)
```bash
cd /home/gzzy/Desktop/workspace/logitux-web && npx jest
```
→ All 148 tests must still pass. No server files are modified.

### Browser
```bash
cd /home/gzzy/Desktop/workspace/logitux-web && npm run dev
```
Verify at http://localhost:5173:

1. On open: shows spinner "Detecting device..."
2. If the Express server is not running: shows error state with Retry button
3. If the server is running but no device in DB:
   - shows "no-device" state
   - `Topbar` has "Detect Device" button
   - click "Detect Device" → triggers `detectDevice()` → if Solaar is installed, detects the device and transitions to `connected`
4. In `connected` state:
   - `Topbar` shows device name (e.g. "MX Master 3")
   - `MousePreview` shows generic SVG with dots for each divertable button
   - Click a dot → `ActionConfigurator` opens in the right panel
   - `ActionConfigurator` shows the selected button with `ActionPicker`
   - Change an action → Save/Apply buttons in `Topbar` become enabled
   - Click "Save" → PUT /api/config → toast "Configuration saved"
   - Click "Apply" → POST /api/config → full pipeline → toast "Configuration applied to Solaar!"
