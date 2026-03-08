# Spec 09 — Implementation Plan: Electron + Packaging

## Fase 1 — Setup de Electron (sin romper el flujo web actual)

### 1.1 Instalar dependencias

```bash
npm install --save-dev electron electron-builder concurrently wait-on
npm install electron-store
```

Ajustar `tsconfig.json` para compilar también `electron/`:
```json
{
  "compilerOptions": {
    "paths": { "*": ["node_modules/*"] }
  },
  "include": ["src", "server", "electron"]
}
```

Crear `tsconfig.electron.json` separado con `"module": "commonjs"` para el main process (Electron main no soporta ESM puro todavía en todas las versiones).

---

### 1.2 `electron/main/index.ts` — Entry point

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { createTray } from './tray.js';
import { startServer, stopServer } from './server-runner.js';
import { checkSolaarStatus, startSolaarMinimized } from './solaar-manager.js';

let mainWindow: BrowserWindow | null = null;
const SERVER_PORT = 3000;

app.whenReady().then(async () => {
  // 1. Arrancar el servidor Express
  await startServer();

  // 2. Crear ventana principal
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Cargar la app desde el servidor local (mismo que en el browser)
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  // Ocultar en lugar de cerrar
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // 3. Crear tray icon
  createTray(mainWindow);

  // 4. Poll de Solaar
  startSolaarPolling(mainWindow);

  // Arrancar minimizado si se pasó --hidden (autostart)
  if (process.argv.includes('--hidden')) {
    mainWindow.hide();
  }
});

app.on('window-all-closed', (e) => e.preventDefault()); // No terminar al cerrar la ventana

app.on('before-quit', () => {
  app.isQuitting = true;
  stopServer();
});

// IPC: iniciar Solaar desde la UI
ipcMain.handle('start-solaar', () => startSolaarMinimized());
```

---

### 1.3 `electron/main/server-runner.ts`

```typescript
import { fork, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

let serverProcess: ChildProcess | null = null;

export async function startServer(): Promise<void> {
  return new Promise((res, rej) => {
    const serverPath = resolve(__dirname, '../../server/index.js'); // build compilado
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: '3000', NODE_ENV: 'production' },
      stdio: 'pipe',
    });

    serverProcess.on('error', rej);
    
    // Esperar a que el servidor esté listo (escuchar stdout)
    serverProcess.stdout?.on('data', (d) => {
      if (d.toString().includes('running on')) res();
    });
    
    // Timeout de seguridad
    setTimeout(res, 5000);
  });
}

export function stopServer(): void {
  serverProcess?.kill('SIGTERM');
  serverProcess = null;
}
```

**Nota**: En producción, `server/index.js` será el output compilado por `tsc`. En desarrollo, usar `tsx` o `ts-node`.

---

### 1.4 `electron/main/tray.ts`

```typescript
import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'node:path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../../assets/tray-icon.png')
  ).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('LogiTux');

  updateTrayMenu(mainWindow, { solaarRunning: false });

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

export function updateTrayMenu(mainWindow: BrowserWindow, state: { solaarRunning: boolean }) {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Abrir LogiTux',
      click: () => { mainWindow.show(); mainWindow.focus(); },
    },
    { type: 'separator' },
    {
      label: `Solaar: ${state.solaarRunning ? '✓ activo' : '✗ inactivo'}`,
      enabled: false,
    },
    ...(state.solaarRunning ? [] : [{
      label: 'Iniciar Solaar',
      click: async () => {
        const { startSolaarMinimized } = await import('./solaar-manager.js');
        startSolaarMinimized();
      },
    }]),
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray?.setContextMenu(menu);
}
```

---

### 1.5 `electron/main/solaar-manager.ts`

```typescript
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export function isSolaarInstalled(): boolean {
  // Verificar por path del binario
  const paths = ['/usr/bin/solaar', '/usr/local/bin/solaar'];
  if (paths.some(p => existsSync(p))) return true;
  
  // Verificar Flatpak
  try {
    execSync('flatpak info io.github.pwr_solaar.solaar', { stdio: 'pipe', timeout: 2000 });
    return true;
  } catch { return false; }
}

export function isSolaarRunning(): boolean {
  try {
    execSync('pgrep -x solaar || pgrep -f "python.*solaar"', { 
      stdio: 'pipe', shell: true, timeout: 2000 
    });
    return true;
  } catch { return false; }
}

export function startSolaarMinimized(): void {
  const isFlatpak = !existsSync('/usr/bin/solaar');
  const cmd = isFlatpak
    ? 'flatpak run io.github.pwr_solaar.solaar'
    : 'solaar';
  
  spawn(cmd, ['--window-close-action=hide-to-tray'], {
    shell: true, detached: true, stdio: 'ignore',
  }).unref();
}

// Polling de estado (llamado desde main/index.ts)
export function startSolaarPolling(mainWindow: BrowserWindow) {
  const poll = () => {
    const running = isSolaarRunning();
    const installed = isSolaarInstalled();
    mainWindow.webContents.send('solaar-status', { running, installed });
    updateTrayMenu(mainWindow, { solaarRunning: running });
  };

  poll(); // Poll inmediato al arrancar
  setInterval(poll, 10_000);
}
```

---

### 1.6 `electron/main/autostart.ts`

```typescript
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { app } from 'electron';

const AUTOSTART_DIR = join(os.homedir(), '.config', 'autostart');
const AUTOSTART_FILE = join(AUTOSTART_DIR, 'logitux.desktop');

export function setAutostart(enabled: boolean): void {
  if (enabled) {
    mkdirSync(AUTOSTART_DIR, { recursive: true });
    writeFileSync(AUTOSTART_FILE, `[Desktop Entry]
Type=Application
Name=LogiTux
Comment=Logitech mouse button configuration  
Exec=${app.getPath('exe')} --hidden
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`);
  } else {
    if (existsSync(AUTOSTART_FILE)) unlinkSync(AUTOSTART_FILE);
  }
}

export function isAutostartEnabled(): boolean {
  return existsSync(AUTOSTART_FILE);
}
```

---

### 1.7 `electron/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Solaar
  onSolaarStatus: (cb: (status: { running: boolean; installed: boolean }) => void) => {
    ipcRenderer.on('solaar-status', (_event, status) => cb(status));
  },
  startSolaar: () => ipcRenderer.invoke('start-solaar'),

  // Autostart
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('set-autostart', enabled),
  getAutostart: () => ipcRenderer.invoke('get-autostart'),
  
  // Utilidad
  isElectron: true,
});
```

---

## Fase 2 — Frontend: Banner de estado de Solaar

### 2.1 `src/components/SolaarStatusBanner.tsx` (nuevo)

Se monta en `App.tsx` debajo del `Topbar`. Solo se muestra cuando hay un problema:

```tsx
// Detecta si corre en Electron via window.electronAPI?.isElectron
// Si no es Electron, usa GET /api/device/status para el estado

const SolaarStatusBanner = () => {
  const [status, setStatus] = useState<{ running: boolean; installed: boolean } | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSolaarStatus(setStatus);
    } else {
      // Fallback HTTP para uso en browser
      fetch('/api/device/status')
        .then(r => r.json())
        .then(d => setStatus({ running: d.data?.running, installed: d.data?.installed }));
    }
  }, []);

  if (!status || (status.installed && status.running)) return null;

  if (!status.installed) return (
    <div className="solaar-banner error">
      ⚠️ Solaar no detectado. ¿Está instalado en el sistema?
      <a href="https://github.com/pwr-Solaar/Solaar" target="_blank">Ver instrucciones</a>
    </div>
  );

  return (
    <div className="solaar-banner warning">
      ⚡ Solaar no está activo.
      <button onClick={() => window.electronAPI?.startSolaar()}>Iniciar Solaar</button>
    </div>
  );
};
```

### 2.2 `SettingsPanel.tsx` — opción de autostart

Agregar un toggle en el panel de ajustes:
```tsx
// Solo visible si isElectron === true
{window.electronAPI && (
  <label>
    <input type="checkbox" checked={autostart} onChange={e => setAutostart(e.target.checked)} />
    Iniciar LogiTux al encender la PC
  </label>
)}
```

---

## Fase 3 — electron-builder.yml y scripts de build

### 3.1 Crear `electron-builder.yml` en la raíz

Ver la configuración completa en `task.md`.

### 3.2 Scripts en `package.json`

```json
{
  "main": "dist-electron/main/index.js",
  "scripts": {
    "electron:dev": "concurrently \"npm run server:dev\" \"wait-on http://localhost:3000 && electron .\"",
    "electron:build": "npm run build && tsc -p tsconfig.electron.json && electron-builder --linux",
    "electron:build:deb": "npm run electron:build -- --target deb",
    "electron:build:rpm": "npm run electron:build -- --target rpm",
    "electron:build:appimage": "npm run electron:build -- --target AppImage"
  }
}
```

---

## Fase 4 — Assets

- `assets/icon.png` — 512x512 (electron-builder genera los tamaños menores automáticamente)
- `assets/tray-icon.png` — 16x16 y 32x32 para el tray (Electron los usa según DPI)

---

### 1.8 Directorio de datos de usuario (`userData`)

Cuando la app se distribuye como AppImage/DEB/RPM, el binario reside en una ruta de solo lectura (`/opt/logitux/` o dentro del AppImage). Los scripts y la base de datos **no pueden vivir junto al binario** — necesitan un directorio que sea:

- Escribible por el usuario
- Persistente entre actualizaciones de la app
- Separado del binario instalado

#### Directorio estándar

```
~/.local/share/logitux/          ← app.getPath('userData') en Electron / XDG_DATA_HOME
├── logitux.db                   ← base de datos SQLite
└── scripts/                     ← scripts del usuario
    ├── nightshift-up.sh
    ├── nightshift-down.sh
    └── nightshift-off.sh
```

#### Pasar `userData` al servidor Express

En `electron/main/server-runner.ts`, inyectar la ruta como variable de entorno al arrancar el proceso del servidor:

```typescript
import { app } from 'electron';

export async function startServer(): Promise<void> {
  return new Promise((res, rej) => {
    const serverPath = resolve(__dirname, '../../server/index.js');
    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: '3000',
        NODE_ENV: 'production',
        LOGITUX_DATA_DIR: app.getPath('userData'),   // ← nuevo
      },
      stdio: 'pipe',
    });
    // ...
  });
}
```

#### Adaptar el servidor para respetar `LOGITUX_DATA_DIR`

En `server/db/index.ts`, resolver la ruta de la DB según el entorno:

```typescript
import { resolve } from 'node:path';

const dataDir = process.env.LOGITUX_DATA_DIR
  ?? resolve(process.cwd(), 'data');        // fallback para modo standalone/dev

export const DB_PATH = resolve(dataDir, 'logitux.db');
export const SCRIPTS_DIR = resolve(dataDir, 'scripts');
```

La función `seedFromDisk()` ya usa `SCRIPTS_DIR` implícitamente si se refactoriza para leerlo desde ahí en vez de hardcodearlo relativo al CWD.

#### Primer arranque: copiar scripts bundleados

Cuando `LOGITUX_DATA_DIR` existe pero `scripts/` está vacío (primera instalación), el servidor debe copiar los scripts por defecto desde `resources/scripts/` (incluidos en el paquete via `electron-builder` con `extraResources`):

```typescript
// server/db/index.ts — llamado al iniciar el servidor
import { existsSync, mkdirSync, cpSync } from 'node:fs';

export function ensureUserDataDir(): void {
  mkdirSync(SCRIPTS_DIR, { recursive: true });

  // En paquete instalado, copiar scripts por defecto si el dir está vacío
  const resourcesScripts = process.env.LOGITUX_RESOURCES_DIR
    ? resolve(process.env.LOGITUX_RESOURCES_DIR, 'scripts')
    : null;

  if (resourcesScripts && existsSync(resourcesScripts)) {
    const files = readdirSync(SCRIPTS_DIR);
    if (files.length === 0) {
      cpSync(resourcesScripts, SCRIPTS_DIR, { recursive: true });
    }
  }
}
```

En `electron-builder.yml`, declarar los scripts como `extraResources`:

```yaml
extraResources:
  - from: scripts/
    to: scripts/
    filter: ["**/*.sh"]
```

Y en `server-runner.ts` pasar también `LOGITUX_RESOURCES_DIR`:

```typescript
LOGITUX_RESOURCES_DIR: process.resourcesPath,   // path de resources/ dentro del paquete
```

#### Modo standalone (sin Electron)

Cuando el servidor corre directamente con `npm run server:dev` o `tsx server/index.ts`, `LOGITUX_DATA_DIR` no está definida y `dataDir` cae al valor por defecto (`./data`), manteniendo el comportamiento actual sin cambios.

---

## Orden de Implementación

1. Instalar dependencias de Electron
2. Crear `electron/` con los 5 archivos de main process
3. Crear `electron/preload/index.ts`
4. Ajustar `tsconfig.json` y crear `tsconfig.electron.json`
5. **Adaptar `server/db/index.ts`** — respetar `LOGITUX_DATA_DIR` y `LOGITUX_RESOURCES_DIR`; agregar `ensureUserDataDir()`; exportar `SCRIPTS_DIR`
6. **Actualizar `server/db/repositories/script.repo.ts`** y `seedFromDisk()` para usar `SCRIPTS_DIR` exportado en vez de path relativo al CWD
7. `SolaarStatusBanner.tsx` — nuevo componente frontend
8. Actualizar `SettingsPanel.tsx` — toggle autostart
9. Añadir `window.electronAPI` al `src/types.ts` global (declare global)
10. Crear `electron-builder.yml` con `extraResources` apuntando a `scripts/`
11. Agregar scripts al `package.json`
12. Crear assets (icon.png, tray-icon.png)
13. Test smoke: `npm run electron:dev`
14. Test build: `npm run electron:build:appimage` y verificar que instala, corre, y los scripts se copian a `~/.local/share/logitux/scripts/`

## Notas Importantes

- **No romper el flujo web**: el servidor Express debe seguir funcionando standalone (`npm run server:dev`) sin Electron. El código del servidor no debe tener imports de Electron.
- **ESM vs CJS en Electron**: Electron 34 soporta ESM nativo en el main process. Usar `"type": "module"` en el package.json de electron o configurar correctamente el bundler.
- **Sandbox en Bazzite/Flatpak**: si LogiTux mismo se distribuye como Flatpak en el futuro, hay que configurar los permisos para acceso a `/dev/input` y para ejecutar `xinput`. Esto es una iteración futura; por ahora el target es AppImage/DEB/RPM que corren nativos.
- **Scripts en modo empaquetado**: Los scripts se empaquetan como `extraResources` y se copian al directorio de datos de usuario (`~/.local/share/logitux/scripts/`) en el primer arranque via `ensureUserDataDir()`.
