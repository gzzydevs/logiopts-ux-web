# Spec 13 — Implementation Plan: Wayland Support para WindowWatcher

## Fase 0 — Diagnóstico y detección de herramientas disponibles

### 0.1 Verificar qué herramientas están disponibles en el host

Antes de implementar, el servidor debe loguear al arranque qué backends están disponibles.
Añadir diagnóstico en `server/services/windowWatcher.ts` o en el bloque de diagnósticos ya existente en `server/index.ts`:

```typescript
// En el bloque [DIAGNOSTICS] existente:
const hasQdbus6 = await hostShell('which qdbus6 2>/dev/null').then(r => !!r).catch(() => false);
const hasDbusMonitor = await hostShell('which dbus-monitor 2>/dev/null').then(r => !!r).catch(() => false);
const hasGdbus = await hostShell('which gdbus 2>/dev/null').then(r => !!r).catch(() => false);
const xdgSession = process.env.XDG_SESSION_TYPE || 'not set';
const xdgDesktop = process.env.XDG_CURRENT_DESKTOP || 'not set';

console.log(`[DIAGNOSTICS] XDG_SESSION_TYPE: ${xdgSession}`);
console.log(`[DIAGNOSTICS] XDG_CURRENT_DESKTOP: ${xdgDesktop}`);
console.log(`[DIAGNOSTICS] has qdbus6: ${hasQdbus6}`);
console.log(`[DIAGNOSTICS] has dbus-monitor: ${hasDbusMonitor}`);
console.log(`[DIAGNOSTICS] has gdbus: ${hasGdbus}`);
```

---

## Fase 1 — Definir la interfaz `WindowBackend`

### 1.1 Crear `server/services/windowBackend.ts`

```typescript
export interface WindowBackend {
  /** Nombre del backend para logs */
  readonly name: string;
  /** Iniciar monitoreo de ventana activa */
  start(): void;
  /** Detener monitoreo */
  stop(): void;
  /** Registrar callback para cambios de ventana. El callback recibe el WM class (e.g. "firefox") */
  onWindowChanged(cb: (className: string) => void): void;
}
```

---

## Fase 2 — Implementar backend X11 (`XpropBackend`)

### 2.1 Crear `server/services/backends/x11Backend.ts`

Extraer la lógica de `xprop -spy` (ya diseñada en Spec 10) a su propia clase que implementa `WindowBackend`.

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import type { WindowBackend } from '../windowBackend.js';
import { USE_HOST_SPAWN, HOST_SPAWN_BIN } from '../solaarDetector.js';
import { hostShell } from '../solaarDetector.js';

export class X11Backend implements WindowBackend {
  readonly name = 'X11 (xprop -spy)';
  private child: ChildProcess | null = null;
  private cb: ((cls: string) => void) | null = null;

  onWindowChanged(cb: (className: string) => void) { this.cb = cb; }

  start() {
    const args = USE_HOST_SPAWN
      ? (HOST_SPAWN_BIN === 'flatpak-spawn'
          ? ['--host', 'xprop', '-spy', '-root', '_NET_ACTIVE_WINDOW']
          : ['xprop', '-spy', '-root', '_NET_ACTIVE_WINDOW'])
      : ['-spy', '-root', '_NET_ACTIVE_WINDOW'];
    const bin = USE_HOST_SPAWN ? HOST_SPAWN_BIN : 'xprop';

    this.child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] });

    let buf = '';
    this.child.stdout?.on('data', (data: Buffer) => {
      buf += data.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/window id # (0x[0-9a-f]+)/i);
        if (match) this.resolveClass(match[1]);
      }
    });

    this.child.on('exit', () => { this.child = null; });
  }

  stop() {
    this.child?.kill();
    this.child = null;
  }

  private async resolveClass(windowId: string) {
    try {
      const out = await hostShell(`xprop -id ${windowId} WM_CLASS 2>/dev/null`);
      // WM_CLASS(STRING) = "code", "Code" → tomar el segundo elemento (resource name)
      const match = out.match(/"([^"]+)"\s*$/);
      if (match && this.cb) this.cb(match[1].toLowerCase());
    } catch { /* ignorar */ }
  }
}
```

---

## Fase 3 — Implementar backend KDE Wayland (`WaylandKDEBackend`)

### 3.1 Crear `server/services/backends/waylandKdeBackend.ts`

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import type { WindowBackend } from '../windowBackend.js';
import { hostShell, USE_HOST_SPAWN, HOST_SPAWN_BIN } from '../solaarDetector.js';

export class WaylandKDEBackend implements WindowBackend {
  readonly name = 'Wayland KDE (dbus-monitor + qdbus6)';
  private monitor: ChildProcess | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private cb: ((cls: string) => void) | null = null;
  private useFallbackPolling = false;

  onWindowChanged(cb: (className: string) => void) { this.cb = cb; }

  start() {
    this.tryEventDriven();
  }

  stop() {
    this.monitor?.kill();
    this.monitor = null;
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  private tryEventDriven() {
    const args = USE_HOST_SPAWN
      ? (HOST_SPAWN_BIN === 'flatpak-spawn'
          ? ['--host', 'dbus-monitor', '--session', 'type=signal,interface=org.kde.KWin,member=windowActivated']
          : ['dbus-monitor', '--session', 'type=signal,interface=org.kde.KWin,member=windowActivated'])
      : ['--session', 'type=signal,interface=org.kde.KWin,member=windowActivated'];
    const bin = USE_HOST_SPAWN ? HOST_SPAWN_BIN : 'dbus-monitor';

    this.monitor = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] });

    // Si dbus-monitor falla rápido, caer a polling
    const timeoutHandle = setTimeout(() => {
      if (this.monitor && !this.monitor.killed) return; // está corriendo bien
      this.startPolling();
    }, 3000);

    this.monitor.stdout?.on('data', () => {
      this.fetchActiveClass();
    });

    this.monitor.on('exit', (code) => {
      this.monitor = null;
      clearTimeout(timeoutHandle);
      if (!this.useFallbackPolling) {
        console.warn('[WindowWatcher] dbus-monitor exited, switching to polling');
        this.startPolling();
      }
    });
  }

  private startPolling() {
    this.useFallbackPolling = true;
    this.fallbackInterval = setInterval(() => this.fetchActiveClass(), 3000);
    this.fetchActiveClass();
  }

  private async fetchActiveClass() {
    try {
      const uuid = await hostShell('qdbus6 org.kde.KWin /KWin activeWindow 2>/dev/null');
      if (!uuid.trim()) return;
      const cls = await hostShell(
        `qdbus6 org.kde.KWin /KWin/Window/${uuid.trim()} resourceClass 2>/dev/null`
      );
      if (cls.trim() && this.cb) this.cb(cls.trim().toLowerCase());
    } catch { /* silencioso */ }
  }
}
```

---

## Fase 4 — Implementar backend GNOME Wayland (`WaylandGNOMEBackend`)

### 4.1 Crear `server/services/backends/waylandGnomeBackend.ts`

GNOME no expone señales D-Bus estables sin extensiones → **polling cada 3 segundos** con `gdbus`.

```typescript
import type { WindowBackend } from '../windowBackend.js';
import { hostShell } from '../solaarDetector.js';

export class WaylandGNOMEBackend implements WindowBackend {
  readonly name = 'Wayland GNOME (gdbus polling)';
  private interval: NodeJS.Timeout | null = null;
  private cb: ((cls: string) => void) | null = null;

  onWindowChanged(cb: (className: string) => void) { this.cb = cb; }

  start() {
    this.interval = setInterval(() => this.fetchActiveClass(), 3000);
    this.fetchActiveClass();
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  private async fetchActiveClass() {
    try {
      // Intentar obtener running apps via Shell.Introspect (GNOME 3.38+)
      const out = await hostShell(
        `gdbus call --session --dest org.gnome.Shell \
          --object-path /org/gnome/Shell/Introspect \
          --method org.gnome.Shell.Introspect.GetRunningApplications 2>/dev/null`
      );
      // Parsear salida: diccionario de {app_id: {focused: bool, ...}}
      const focusedMatch = out.match(/'([^']+)'.*?'focused'.*?true/);
      if (focusedMatch && this.cb) {
        // app_id suele ser "org.gnome.Nautilus" → tomar la última parte
        const appId = focusedMatch[1].split('.').pop()?.toLowerCase();
        if (appId) this.cb(appId);
      }
    } catch { /* silencioso */ }
  }
}
```

---

## Fase 5 — Implementar backend Fallback (`FallbackBackend` / NoOpBackend)

### 5.1 Crear `server/services/backends/fallbackBackend.ts`

```typescript
import type { WindowBackend } from '../windowBackend.js';

export class FallbackBackend implements WindowBackend {
  readonly name = 'Fallback (disabled)';
  onWindowChanged() {}
  start() {
    console.warn('[WindowWatcher] No compatible window backend found. Per-app profile switching is disabled.');
    console.warn('[WindowWatcher] Supported: X11, Wayland+KDE (qdbus6), Wayland+GNOME (gdbus)');
  }
  stop() {}
}
```

---

## Fase 6 — Refactorizar `WindowWatcher`

### 6.1 Reescribir `server/services/windowWatcher.ts`

```typescript
import EventEmitter from 'node:events';
import type { WindowBackend } from './windowBackend.js';
import { X11Backend } from './backends/x11Backend.js';
import { WaylandKDEBackend } from './backends/waylandKdeBackend.js';
import { WaylandGNOMEBackend } from './backends/waylandGnomeBackend.js';
import { FallbackBackend } from './backends/fallbackBackend.js';
import { hostShell } from './solaarDetector.js';

async function detectSessionType(): Promise<'x11' | 'wayland-kde' | 'wayland-gnome' | 'unknown'> {
  const session = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
  const desktop = (process.env.XDG_CURRENT_DESKTOP || '').toLowerCase();

  if (!session || session === 'x11') return 'x11';

  if (session === 'wayland') {
    if (desktop.includes('kde') || process.env.KDE_FULL_SESSION) return 'wayland-kde';
    if (desktop.includes('gnome') || process.env.GNOME_DESKTOP_SESSION_ID) return 'wayland-gnome';

    // Detección via D-Bus como fallback
    try {
      const kwin = await hostShell('qdbus6 org.kde.KWin / 2>/dev/null | head -1');
      if (kwin) return 'wayland-kde';
    } catch {}
    try {
      const gnome = await hostShell('gdbus introspect --session --dest org.gnome.Shell --object-path /org/gnome/Shell 2>/dev/null | head -1');
      if (gnome) return 'wayland-gnome';
    } catch {}
  }

  return 'unknown';
}

function createBackend(type: 'x11' | 'wayland-kde' | 'wayland-gnome' | 'unknown'): WindowBackend {
  switch (type) {
    case 'x11':         return new X11Backend();
    case 'wayland-kde': return new WaylandKDEBackend();
    case 'wayland-gnome': return new WaylandGNOMEBackend();
    default:            return new FallbackBackend();
  }
}

export class WindowWatcher extends EventEmitter {
  private backend: WindowBackend | null = null;
  private currentClass: string | null = null;

  async start() {
    if (this.backend) return;
    const sessionType = await detectSessionType();
    this.backend = createBackend(sessionType);
    console.log(`[WindowWatcher] Using backend: ${this.backend.name}`);
    this.backend.onWindowChanged((cls) => {
      if (cls !== this.currentClass) {
        this.currentClass = cls;
        this.emit('window-changed', cls);
      }
    });
    this.backend.start();
  }

  stop() {
    this.backend?.stop();
    this.backend = null;
  }

  getCurrentClass(): string | null {
    return this.currentClass;
  }
}

export const windowWatcher = new WindowWatcher();
```

### 6.2 Actualizar `server/index.ts`

Cambiar la llamada a `windowWatcher.start()` para awaitar (ahora es `async`):

```typescript
// Antes:
windowWatcher.start();

// Después:
await windowWatcher.start();
```

---

## Fase 7 — Tests

### 7.1 Crear `server/services/__tests__/windowWatcher.test.ts`

Casos a cubrir:
- `detectSessionType()` retorna `'wayland-kde'` cuando `XDG_SESSION_TYPE=wayland` y `XDG_CURRENT_DESKTOP=KDE`
- `detectSessionType()` retorna `'x11'` cuando `XDG_SESSION_TYPE=x11`
- `detectSessionType()` retorna `'unknown'` cuando las variables no están seteadas
- `WindowWatcher` emite `'window-changed'` cuando el backend reporta una nueva clase
- `WindowWatcher.stop()` llama `backend.stop()`

---

## Resumen de Archivos

| Archivo | Acción |
|---------|--------|
| `server/services/windowBackend.ts` | ✅ Crear — interfaz `WindowBackend` |
| `server/services/backends/x11Backend.ts` | ✅ Crear — backend X11 con xprop |
| `server/services/backends/waylandKdeBackend.ts` | ✅ Crear — backend KDE con qdbus6 |
| `server/services/backends/waylandGnomeBackend.ts` | ✅ Crear — backend GNOME con gdbus |
| `server/services/backends/fallbackBackend.ts` | ✅ Crear — no-op silencioso |
| `server/services/windowWatcher.ts` | 🔄 Refactorizar |
| `server/index.ts` | 🔄 Awaitar `windowWatcher.start()` |
| `server/services/__tests__/windowWatcher.test.ts` | ✅ Crear — unit tests |
