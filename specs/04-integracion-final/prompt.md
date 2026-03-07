# 🚀 Prompt — Final Integration: Rewrite `src/App.tsx`

## Project context

LogiTux is a web app (Vite + React + Express) for configuring Logitech mouse macros on Linux via Solaar.
Runs on Bazzite (immutable Fedora with Flatpak), Node at `~/.nvm/versions/node/v24.14.0`.
Working directory: `/home/gzzy/Desktop/workspace/logitux-web`

---

## Current state: the ENTIRE new frontend is already implemented except one file

The following files are **already written and correct** — do NOT modify:

| File | Status |
|---|---|
| `src/types.ts` | ✅ Complete types: KnownDevice, ButtonConfig, SolaarAction, Profile, Script, BootstrapData, Toast |
| `src/main.tsx` | ✅ Already wraps in `<AppProvider>` |
| `src/context/AppContext.tsx` | ✅ Rewritten: correct types, has bootstrap(), detectDevice(), updateButton(), saveConfig(), applyCurrentConfig(), toast management, dirty tracking |
| `src/hooks/useApi.ts` | ✅ Has fetchBootstrap(), saveConfigToDB() (PUT), applyConfig() (POST), fetchDevice(), fetchSystemActions() |
| `src/components/Topbar.tsx` | ✅ Uses useAppContext(), Save + Apply buttons with loading states, Detect Device button, profile selector |
| `src/components/Toast.tsx` | ✅ Exists with ToastContainer component |
| `src/components/MousePreview.tsx` | ✅ Uses useAppContext(), renders buttons dynamically from device.buttons |
| `src/components/ActionConfigurator.tsx` | ✅ Uses SolaarAction, useAppContext(), ActionPicker for gesture/simple mode |
| `src/components/ActionPicker.tsx` | ✅ Functional, supports all SolaarAction types |
| `src/components/SettingsPanel.tsx` | ✅ Clean, uses useAppContext() |

---

## 🔴 THE ONLY PROBLEM: `src/App.tsx` is the OLD version

The current `App.tsx` **completely ignores AppContext**. It has its own local state and calls the server directly. As a result, `Topbar`, `MousePreview`, `SettingsPanel`, `ToastContainer` — all the new components — are never mounted.

### What the old App.tsx does (delete all of this):
- Own `useState` for: device, deviceMeta, dpi, buttons, selectedCid, systemActions, status, message, hasChanges
- Calls directly: `fetchDevice()`, `fetchConfig()`, `fetchSystemActions()`, `applyConfig()`, `resetConfig()`
- Renders old components: `<MouseView>`, `<ButtonConfigPanel>`, `<ProfileManager>`
- Has its own `handleApply()` in the `<footer>` (hardcoded Apply button)
- **Never uses `useAppContext()`**
- **Never renders `<Topbar>`, `<SettingsPanel>`, `<MousePreview>`, or `<ToastContainer>`**

---

## 🎯 The task: rewrite `src/App.tsx`

### Complete new App.tsx:

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

### Required CSS in `App.css`:

Read the existing `App.css` before modifying. Add or update the following classes (without removing styles other components rely on):

```css
/* ─── App root layout ────────────────────────────────────── */
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

/* ─── State screens (loading / error / no-device) ────────── */
.app-state-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
  text-align: center;
  padding: 32px;
}

.app-state-error {
  color: #ff6b6b;
}

/* ─── Loading spinner ─────────────────────────────────────── */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent, #7c3aed);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## ⚠️ Critical notes

1. **Do not modify any server files** (`server/`) — the backend is correct. `npx jest` must continue passing all 148 tests.

2. **The Apply flow is**:
   - `Topbar` calls `applyCurrentConfig()` from AppContext
   - AppContext builds `SolaarConfig` + `ButtonConfig[]` and calls POST `/api/config`
   - Backend: `buttonConfigsToProfileConfig()` → `jsonToSolaarYaml()` → `apply-solaar.sh`
   - `apply-solaar.sh` writes `config.yaml` + `rules.yaml` and restarts Solaar via `flatpak-spawn --host`

3. **The Express server runs on port 3001** — Vite proxies `/api` to 3001 (see `vite.config.ts`).
   Start both with `npm run dev` if configured, or start the server separately: `npx tsx server/index.ts`

4. **Bootstrap auto-detects**: when calling `GET /api/bootstrap`, if no device is in DB, the server runs `solaar show` automatically. If Solaar is not running on the host, it returns `devices: []` and `appStatus` stays at `no-device`.

5. **Key chords in Solaar**: `keys: ['Control_L', 'c']` = simultaneous chord. Rendered in YAML as `- [Control_L, c]`. It is NOT a comma-separated string — it is an array.

---

## Verification

```bash
# Backend tests — must NOT change
cd /home/gzzy/Desktop/workspace/logitux-web && npx jest
# Expected: 148 passed, 148 total

# Dev server
npm run dev
```

Browser at http://localhost:5173:

1. **Loading**: spinner + "Detecting device..."
2. **No device**: message + Topbar with "Detect Device" button
3. **Connected**: MousePreview with button dots + SettingsPanel
4. Click a dot → ActionConfigurator opens on the right
5. Change an action → Save/Apply become enabled in Topbar
6. Click Save → toast "Configuration saved"
7. Click Apply → full pipeline → toast "Configuration applied to Solaar!"
