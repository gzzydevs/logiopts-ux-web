# Spec 13 — SDD: Wayland Support para WindowWatcher

## Arquitectura: Multi-Backend WindowWatcher

### Visión General

`WindowWatcher` se refactoriza para delegar la detección de ventana activa a un **backend intercambiable**. El backend se selecciona una sola vez en `start()` según el entorno detectado.

```
WindowWatcher.start()
       │
       ▼
  detectBackend()
       │
       ├── XDG_SESSION_TYPE=x11  → X11Backend  (xprop -spy, event-driven)
       │
       ├── XDG_SESSION_TYPE=wayland
       │       ├── KDE detectado  → WaylandKDEBackend  (dbus-monitor + qdbus6)
       │       ├── GNOME detectado → WaylandGNOMEBackend (gdbus call, polling)
       │       └── compositor desconocido → FallbackBackend (polling silencioso)
       │
       └── SESSION_TYPE no definido → FallbackBackend
```

---

## Detección del Compositor

```typescript
type SessionType = 'x11' | 'wayland-kde' | 'wayland-gnome' | 'unknown';

async function detectSessionType(): Promise<SessionType> {
  const session = process.env.XDG_SESSION_TYPE;
  
  if (!session || session === 'x11') return 'x11';
  
  if (session === 'wayland') {
    // Detectar KDE: variable de entorno o servicio D-Bus
    if (process.env.KDE_FULL_SESSION || process.env.XDG_CURRENT_DESKTOP?.toLowerCase().includes('kde')) {
      return 'wayland-kde';
    }
    if (process.env.GNOME_DESKTOP_SESSION_ID || process.env.XDG_CURRENT_DESKTOP?.toLowerCase().includes('gnome')) {
      return 'wayland-gnome';
    }
    // Fallback: intentar detectar por servicio D-Bus disponible
    const hasKWin = await checkDBusService('org.kde.KWin');
    if (hasKWin) return 'wayland-kde';
    
    const hasGnomeShell = await checkDBusService('org.gnome.Shell');
    if (hasGnomeShell) return 'wayland-gnome';
  }
  
  return 'unknown';
}
```

---

## Backend X11: `xprop -spy`

> Mantiene el diseño de Spec 10. Sin cambios.

```bash
xprop -spy -root _NET_ACTIVE_WINDOW
# Emite líneas cuando cambia la ventana activa:
# _NET_ACTIVE_WINDOW(WINDOW): window id # 0x3e00004
```

Al recibir un nuevo Window ID, se resuelve el WM_CLASS con:

```bash
xprop -id 0x3e00004 WM_CLASS
# WM_CLASS(STRING) = "code", "Code"
```

---

## Backend Wayland KDE: `dbus-monitor` + `qdbus6`

### Obtener ventana activa (one-shot)

```bash
# Paso 1: Obtener UUID de la ventana activa
qdbus6 org.kde.KWin /KWin activeWindow
# → "c3de5fce-4c13-4bb9-87a5-c2af38f6d62c"

# Paso 2: Obtener resourceClass (WM_CLASS normalizado)
qdbus6 org.kde.KWin /KWin/Window/c3de5fce-4c13-4bb9-87a5-c2af38f6d62c resourceClass
# → "firefox"
```

### Monitoreo de cambios (event-driven)

```bash
dbus-monitor --session "type=signal,interface=org.kde.KWin,member=windowActivated"
```

Al recibir la señal, invocar el one-shot para obtener la clase de la nueva ventana.

> **Nota**: `dbus-monitor` no existe nativamente en todos los entornos contenedorizados; si falla, caer a polling de 3 segundos con `qdbus6`.

### Flujo completo

```
dbus-monitor (proceso hijo persistente)
       │
       │ señal: windowActivated
       ▼
  qdbus6 activeWindow  →  window UUID
       │
  qdbus6 /KWin/Window/<uuid> resourceClass
       │
       ▼
  emit('window-changed', className)
```

---

## Backend Wayland GNOME: `gdbus` (polling)

GNOME Wayland no expone una señal D-Bus estable para cambio de ventana activa sin extensiones instaladas. Se usa **polling vía `gdbus call`** cada 3 segundos.

```bash
gdbus call \
  --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Introspect \
  --method org.gnome.Shell.Introspect.GetRunningApplications
```

> Si `org.gnome.Shell.Introspect` no está disponible (versiones antiguas), intentar:

```bash
# Alternativa: xdotool vía XWayland (funciona para apps X11/XWayland)
xdotool getactivewindow getwindowclassname 2>/dev/null
# Envolver con timeout y trap SIGABRT por si crashea
```

---

## Backend Fallback

Cuando no se puede determinar el compositor o ningún backend responde:

- Log de advertencia UNA SOLA VEZ al arrancar: `[WindowWatcher] No active window backend available — per-app profiles disabled`
- **No polling**, no spawns en loop
- `getCurrentClass()` devuelve `null` permanentemente
- La aplicación funciona normalmente sin auto-cambio de perfil por ventana

---

## Interfaz del Backend

```typescript
interface WindowBackend {
  start(): void;
  stop(): void;
  onWindowChanged(cb: (className: string) => void): void;
}
```

`WindowWatcher` usa el backend como adaptador:

```typescript
class WindowWatcher extends EventEmitter {
  private backend: WindowBackend | null = null;

  async start() {
    if (this.backend) return;
    const sessionType = await detectSessionType();
    this.backend = createBackend(sessionType);
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
}
```

---

## Manejo de Errores

| Escenario | Comportamiento |
|-----------|---------------|
| `xdotool` crash en Wayland | Detectado antes de llamar, backend KDE/GNOME usado en su lugar |
| `qdbus6` no instalado | Log de warning, caer a FallbackBackend |
| `dbus-monitor` sale inesperadamente | Reintentar backend en modo polling (no reiniciar el proceso monitor) |
| GNOME sin `Introspect` | Log de warning, desactivar watcher silenciosamente |
| Entorno headless/CI | `XDG_SESSION_TYPE` no definido → FallbackBackend desde el inicio |

---

## Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `server/services/windowWatcher.ts` | Refactor completo con sistema de backends |
| `server/services/solaarDetector.ts` | Sin cambios (se sigue usando `hostShell`/`hostExec`) |
| `server/index.ts` | Sin cambios (la API pública no cambia) |
