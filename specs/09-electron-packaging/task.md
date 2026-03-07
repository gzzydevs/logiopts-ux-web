# Spec 09 — Electron Desktop App + Distribución de Paquetes

## Contexto

LogiTux actualmente corre como una aplicación web local:
- **Backend**: servidor Express en Node.js (puerto 3000)
- **Frontend**: React + Vite, servido en puerto 5173 (dev) o como build estático en producción desde el servidor Express

La experiencia de usuario ideal es la de una aplicación de escritorio nativa — similar a Logi Options+ — que:
- Se instala como cualquier programa del sistema
- Tiene ícono en la barra de tareas (system tray)
- Puede iniciarse al arrancar la PC
- No requiere que el usuario abra un browser manualmente
- Detecta y gestiona Solaar sin que el usuario intervenga manualmente

---

## Objetivos

1. **Electron**: envolver la app en Electron para distribuirla como app de escritorio
2. **Packaging**: generar instaladores para `.deb`, `.rpm`, `.AppImage`, `.pacman`
3. **Tray icon**: minimizar a bandeja del sistema en lugar de cerrar
4. **Autostart**: opción para iniciar al encender la PC (usando XDG autostart)
5. **Gestión de Solaar**: detección de proceso, opción de levantar Solaar desde la app

---

## Análisis de Arquitectura Electron

### Modelo de procesos

```
┌─────────────────────────────────────────────────┐
│            Electron Main Process                │
│  - Arranca el servidor Express (fork/import)    │
│  - Gestiona la ventana BrowserWindow            │
│  - Crea el Tray icon                            │
│  - Maneja autostart y ciclo de vida de la app   │
└─────────────────────────────────────────────────┘
                        │
           IPC / HTTP localhost
                        │
┌────────────────────────────────────────────────────┐
│      Renderer Process (BrowserWindow)              │
│  - Carga http://localhost:3000 (React app)         │
│  - O puede cargar directamente el build estático   │
└────────────────────────────────────────────────────┘
                        │
┌────────────────────────────────────────────────────┐
│         Express Server (child_process)             │
│  - El servidor actual sin modificaciones           │
│  - Iniciado por el Main process al arrancar        │
└────────────────────────────────────────────────────┘
```

**Opción elegida**: Electron renderiza la URL `http://localhost:3000` donde el servidor Express sirve el build estático. El servidor Express corre como un child process lanzado por Electron Main. Esta opción:
- Requiere mínimas modificaciones al código existente
- Permite que el servidor siga funcionando sin Electron (para usuarios power-user que prefieren el browser)
- Separa claramente las responsabilidades

### Alternativa descartada — preload + IPC puro

Reescribir el servidor como módulo Electron con IPC en lugar de HTTP añadiría complejidad innecesaria y rompería la posibilidad de usar la app sin Electron.

---

## Gestión de Solaar

### Detección de proceso

**No** usar `solaar show` ni comandos de CLI para detectar si Solaar está corriendo. En cambio, leer la lista de procesos:

```typescript
// electron/main/solaar-manager.ts
import { execSync } from 'node:child_process';

function isSolaarRunning(): boolean {
  try {
    // Buscar proceso 'solaar' en la lista de procesos
    const out = execSync('pgrep -x solaar || pgrep -f "solaar"', { 
      stdio: 'pipe', 
      timeout: 2000 
    }).toString().trim();
    return out.length > 0;
  } catch {
    return false; // pgrep retorna exit 1 si no encuentra nada
  }
}
```

**Casos a manejar:**

| Situación | UI |
|---|---|
| `solaar` no instalado | Banner rojo: "Solaar no detectado en el sistema. ¿Está instalado?" con link a instrucciones |
| Solaar instalado pero no corriendo | Banner amarillo: "Solaar no está activo" + botón "Iniciar Solaar" |
| Solaar corriendo | Estado normal |

### Iniciar Solaar minimizado

```typescript
function startSolaarMinimized(): void {
  const installType = detectInstallType(); // flatpak vs system
  const cmd = installType === 'flatpak'
    ? 'flatpak run io.github.pwr_solaar.solaar --window-close-action=hide-to-tray'
    : 'solaar --window-close-action=hide-to-tray';
  
  spawn(cmd, { shell: true, detached: true, stdio: 'ignore' }).unref();
}
```

**Nota**: `--window-close-action=hide-to-tray` es una opción de Solaar ≥1.1.x. Para versiones anteriores, usar simplemente `solaar` sin flags.

### Polling de estado de Solaar

Verificar el estado de Solaar cada 10 segundos desde Electron Main y enviar el estado al renderer via IPC:

```typescript
setInterval(() => {
  const running = isSolaarRunning();
  mainWindow?.webContents.send('solaar-status', { running });
}, 10_000);
```

---

## Tray Icon

### Comportamiento

- Al iniciar la app: mostrar ventana principal
- Al hacer click en "X" (cerrar ventana): **ocultar la ventana**, no terminar la app
- Ícono en el system tray siempre visible mientras la app está activa
- Menú del tray:
  - "Abrir LogiTux" — muestra la ventana
  - "Estado de Solaar: ✓ activo / ✗ inactivo"
  - "Iniciar Solaar" (visible solo si no está corriendo)
  - Separador
  - "Salir" — termina la app completamente

### Ícono del tray

Usar SVG convertido a PNG 16x16 y 32x32. El ícono puede ser el logo de LogiTux o un ratón genérico.

---

## Autostart

### Implementación via XDG Autostart (Linux estándar)

No usar systemd ni scripts de init — XDG autostart es cross-DE (funciona en GNOME, KDE, XFCE, etc.):

```typescript
// Crear ~/.config/autostart/logitux.desktop
const autostartPath = path.join(os.homedir(), '.config/autostart/logitux.desktop');
const desktopContent = `[Desktop Entry]
Type=Application
Name=LogiTux
Comment=Logitech mouse configuration
Exec=/opt/LogiTux/logitux --hidden
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
`;
```

El flag `--hidden` hace que Electron arranque minimizado al tray sin mostrar la ventana.

---

## Packaging con electron-builder

### Configuración `electron-builder.yml`

```yaml
appId: com.logitux.app
productName: LogiTux
copyright: LogiTux contributors

directories:
  output: dist-electron

linux:
  target:
    - target: AppImage
      arch: [x64, arm64]
    - target: deb
      arch: [x64, arm64]
    - target: rpm
      arch: [x64, arm64]
    - target: pacman
      arch: [x64]
  category: Utility
  desktop:
    Name: LogiTux
    Comment: Logitech mouse button configuration
    Keywords: logitech;solaar;mouse;input
  maintainer: LogiTux contributors

deb:
  depends:
    - solaar | flatpak    # soft dependency
    - xinput
    - xdotool

rpm:
  depends:
    - solaar
    - xinput
    - xdotool

afterPack: electron/scripts/after-pack.js
```

### Scripts de build

```json
// package.json scripts:
"electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\"",
"electron:build": "npm run build && electron-builder --linux",
"electron:build:deb": "npm run build && electron-builder --linux deb",
"electron:build:rpm": "npm run build && electron-builder --linux rpm",
"electron:build:appimage": "npm run build && electron-builder --linux AppImage"
```

---

## Estructura de Archivos Nueva

```
logitux-web/
├── electron/
│   ├── main/
│   │   ├── index.ts           ← Entry point de Electron Main
│   │   ├── tray.ts            ← Tray icon y menú
│   │   ├── autostart.ts       ← XDG autostart
│   │   ├── solaar-manager.ts  ← Detección y arranque de Solaar
│   │   └── server-runner.ts   ← Arranca el Express server como child_process
│   ├── preload/
│   │   └── index.ts           ← Preload script (expone APIs seguras al renderer)
│   └── scripts/
│       └── after-pack.js      ← Post-build script para electron-builder
├── electron-builder.yml
└── ... (resto igual)
```

---

## Cambios en `src/` (frontend)

### Detección de contexto Electron

```typescript
// src/utils/platform.ts
export const isElectron = typeof window !== 'undefined' && 
  window.navigator.userAgent.includes('Electron');
```

### Banner de estado de Solaar

Agregar un componente `SolaarStatusBanner` que:
- Se muestra en la parte superior de la app (debajo del Topbar)
- Escucha el evento IPC `solaar-status` del main process
- Muestra el estado con colores claros y botón de acción

En modo browser (sin Electron), el banner puede usar el endpoint `GET /api/device/status` existente.

---

## Dependencias Nuevas

| Paquete | Versión | Licencia | Motivo |
|---|---|---|---|
| `electron` | ^34.x | MIT | Runtime de escritorio |
| `electron-builder` | ^25.x | MIT | Packaging DEB/RPM/AppImage |
| `concurrently` | ^8.x | MIT | Dev: arrancar Electron + Vite juntos |
| `wait-on` | ^7.x | MIT | Dev: esperar que el server esté listo |
| `electron-store` | ^10.x | MIT | Persistencia de preferencias de la app (autostart, etc.) |

---

## Consideraciones de Seguridad

- `contextIsolation: true` — obligatorio en Electron moderno
- `nodeIntegration: false` — el renderer NO tiene acceso directo a Node.js
- `webSecurity: true` — no deshabilitar la política de seguridad web
- La comunicación renderer → main SOLO via `preload.ts` con `contextBridge.exposeInMainWorld`
- El renderer carga `http://localhost:3000` (localhost, no `file://`) — evita problemas de CORS y mantiene la arquitectura actual intacta

---

## Scope Excluido

- Soporte para Windows o macOS (Solaar es Linux-only)
- Auto-actualización de la app (electron-updater) — puede ser una iteración futura
- Firma de paquetes / code signing
- Publicar en Flathub, AUR, o repositorios oficiales de distros (proceso manual externo)
