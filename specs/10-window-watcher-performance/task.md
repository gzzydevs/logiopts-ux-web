# Spec 10 — Window Watcher Performance + Solaar Config Hot-Reload

## Contexto

### WindowWatcher actual

```typescript
// server/services/windowWatcher.ts
this.interval = setInterval(() => this.poll(), 2000);

private async poll() {
    const windowClass = await this.getActiveWindow();
    // ...
}

private async getActiveWindow(): Promise<string | null> {
    const result = await hostShell('xdotool getactivewindow getwindowclassname 2>/dev/null');
    return result.trim() || null;
}
```

**Problemas con el polling cada 2 segundos:**
1. **Latencia**: hasta 2 segundos entre el cambio de ventana y el cambio de perfil del mouse
2. **CPU idle**: 30 spawns de `xdotool` por minuto incluso cuando no hay cambios
3. **Ruido de procesos**: cada poll lanza un subproceso `xdotool`, visible en `htop`
4. **Unreliable en entornos con sandbox**: `hostShell` hace el spawn con `flatpak-spawn --host`, doble overhead

### Solaar config apply actual

`scripts/apply-solaar.sh` termina Solaar con `pkill`, espera 1 segundo, y lo relanza. El ciclo completo tarda ~3–4 segundos. Esto es visible y molesto cuando el window watcher cambia perfiles frecuentemente.

---

## Objetivos

1. **WindowWatcher event-driven**: latencia < 50ms al cambiar de ventana
2. **Eliminar polling**: cero CPU en idle, sin spawns innecesarios
3. **Solaar hot-reload**: aplicar cambios de configuración sin reiniciar Solaar si es posible
4. **Soporte X11 y Wayland**: la implementación debe contemplar ambos display servers
5. **Fallback graceful**: si la solución event-driven no está disponible, volver al polling

---

## Análisis de Opciones para WindowWatcher

### Opción A — `xprop -spy` (recomendada para X11)

`xprop -spy -root _NET_ACTIVE_WINDOW` es un comando que **bloquea y hace streaming** de cambios a la propiedad `_NET_ACTIVE_WINDOW` de la ventana root del compositor X11. Solo imprime cuando hay un cambio real.

```bash
# Salida de ejemplo al cambiar de ventana:
_NET_ACTIVE_WINDOW(WINDOW): window id # 0x3e00004
_NET_ACTIVE_WINDOW(WINDOW): window id # 0x5200080
```

**Ventajas:**
- **0 CPU en idle** — el proceso duerme bloqueado en la conexión X11
- **Latencia < 10ms** — el evento llega vía protocolo X11, sin polling
- `xprop` es parte del paquete `x11-xserver-utils` / `xorg-x11-utils`, disponible en todas las distros Linux con X11
- Ya disponible en el sistema (`/usr/bin/xprop` confirmado)
- Solo un proceso permanente en lugar de uno cada 2 segundos

**Funcionamiento:**
```typescript
// Reemplazar setInterval → spawn de un proceso permanente
const child = spawn('xprop', ['-spy', '-root', '_NET_ACTIVE_WINDOW']);
child.stdout.on('data', (data) => {
  const match = data.toString().match(/window id # (0x[0-9a-f]+)/i);
  if (match) {
    const windowId = match[1];
    // Resolverwindow class a partir del ID
    getWindowClass(windowId).then(cls => {
      if (cls !== this.currentClass) {
        this.currentClass = cls;
        this.emit('window-changed', cls);
      }
    });
  }
});
```

Para obtener la clase a partir del ID de ventana:
```bash
xprop -id 0x3e00004 WM_CLASS
# Output: WM_CLASS(STRING) = "code", "Code"  ← nombre de clase
```

**Limitación**: Solo funciona en X11. En Wayland puro, `xprop` no funciona (a menos que se use XWayland).

---

### Opción B — Worker en C con Xlib (event-driven nativo)

Un binario standalone en C que usa `Xlib` directamente para subscribirse a eventos de cambio de ventana activa:

```c
// watcher.c
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <stdio.h>

int main() {
    Display *dpy = XOpenDisplay(NULL);
    Window root = DefaultRootWindow(dpy);
    
    // Subscribir a cambios de propiedades de la ventana root
    XSelectInput(dpy, root, PropertyChangeMask);
    
    Atom net_active = XInternAtom(dpy, "_NET_ACTIVE_WINDOW", False);
    Atom wm_class = XInternAtom(dpy, "WM_CLASS", False);
    
    XEvent event;
    while (1) {
        XNextEvent(dpy, &event);  // bloqueante - 0 CPU en idle
        if (event.type == PropertyNotify && event.xproperty.atom == net_active) {
            // Leer el ID de la ventana activa
            // Leer WM_CLASS de esa ventana
            // Imprimir a stdout: "classname\n"
        }
    }
}
```

**Ventajas sobre `xprop -spy`:**
- Un solo proceso + sin subprocesos para resolver la clase (todo en un proceso)
- No depende de `xprop` instalado en el sistema
- Control total sobre el formato de salida

**Desventajas:**
- Requiere paso de compilación en el build del proyecto
- Aumenta la complejidad del proyecto (código C mezclado con TypeScript)
- En la práctica, `xprop -spy` hace exactamente lo mismo con la misma eficiencia
- La diferencia de performance vs `xprop -spy` es negligible

**Conclusión**: La opción B añade complejidad sin beneficio real. La Opción A (`xprop -spy`) ofrece las mismas características de latencia y CPU. El worker en C está justificado solo si `xprop` no está disponible en el sistema target, lo cual es improbable en cualquier sistema X11.

---

### Opción C — Wayland nativo

Wayland no expone `_NET_ACTIVE_WINDOW` (es un protocolo X11). Las opciones dependen del compositor:

| Compositor | Mecanismo | Disponibilidad |
|---|---|---|
| KDE/KWin | `qdbus org.kde.KWin /KWin activeWindow` + `kdotool` | Solo KDE |
| GNOME/Mutter | `gdbus subscribe org.gnome.Shell /org/gnome/Shell` | Solo GNOME |
| Sway/i3 | `swaymsg -t subscribe '["window"]'` | Solo Sway |
| Hyprland | `hyprctl --instance socketpath dispatch` + socket events | Solo Hyprland |
| XWayland | `xprop -spy` funciona normalmente para apps XWayland | Universal con caveats |

**Conclusión**: No existe una solución universal para Wayland. La solución correcta es:
1. Detectar el display server al arrancar (`WAYLAND_DISPLAY` env var)
2. En X11 → Opción A (`xprop -spy`)
3. En Wayland → mantener polling como fallback hasta que haya una solución estable

---

## Análisis de Solaar Hot-Reload

### ¿Puede Solaar recargar su config sin reiniciarse?

**Investigación del CLI de Solaar:**

```bash
solaar config <device> [setting] [value]
# Ejemplo:
solaar config "LIFT" divert-keys "{83: 2, 86: 2}"
```

`solaar config` **se comunica con la instancia de Solaar en ejecución** via D-Bus. Si Solaar está corriendo, este comando aplica el cambio de configuración **en tiempo real, sin reiniciar Solaar**.

Esto significa:
- `divert-keys` se puede cambiar sin reiniciar
- Los cambios a `rules.yaml` **sí** requieren reinicio (Solaar carga las reglas al iniciar, no las recarga en caliente)

**Conclusión**: La solución híbrida es:
1. Cambiar `divert-keys` via `solaar config <device> divert-keys {...}` (sin reinicio)
2. Para `rules.yaml`, **sí** reiniciar, pero solo si las reglas cambiaron

### Implementación del flujo híbrido

```bash
# Script nuevo: apply-solaar-fast.sh
# Solo aplica divert-keys sin reiniciar Solaar si las reglas no cambiaron

DEVICE="$1"
DIVERT_MAP="$2"  # JSON: {"83": 2, "86": 2}
RULES_CHANGED="$3"  # "true" o "false"

# 1. Aplicar divert-keys via CLI (instantáneo, sin restart)
solaar config "$DEVICE" divert-keys "$DIVERT_MAP"

# 2. Solo si las reglas cambiaron, actualizar rules.yaml y reiniciar
if [[ "$RULES_CHANGED" == "true" ]]; then
  echo "$RULES_YAML_CONTENT" > "$RULES_FILE"
  # Reinicio rápido
  pkill -INT -f "python.*solaar" && sleep 0.5 && solaar --window=hide &
fi
```

**Casos de uso:**
- **Cambio de ventana (window watcher)**: solo `divert-keys` → sin reinicio → instantáneo
- **Cambio de perfil por el usuario**: puede cambiar reglas → reinicio necesario

---

## Mejoras Propuestas

### WW-01: Reemplazar polling con `xprop -spy`

**Archivo**: `server/services/windowWatcher.ts`

Reemplazar `setInterval` + `hostShell('xdotool ...')` con un proceso permanente `xprop -spy`:

```typescript
export class WindowWatcher extends EventEmitter {
    private child: ChildProcess | null = null;
    private currentClass: string | null = null;

    start() {
        if (this.child) return;
        
        const displayServer = this.detectDisplayServer();
        
        if (displayServer === 'x11') {
            this.startX11Watcher();
        } else {
            // Wayland fallback: polling 2s (comportamiento actual)
            this.startPollingFallback();
        }
    }

    private detectDisplayServer(): 'x11' | 'wayland' {
        // WAYLAND_DISPLAY está seteada solo en Wayland nativo
        // En XWayland, DISPLAY también está seteada pero los eventos X funcionan
        return process.env.WAYLAND_DISPLAY && !process.env.DISPLAY
            ? 'wayland'
            : 'x11';
    }

    private startX11Watcher() {
        const cmd = USE_HOST_SPAWN ? HOST_SPAWN_BIN : 'xprop';
        const args = USE_HOST_SPAWN
            ? [...(HOST_SPAWN_BIN === 'flatpak-spawn' ? ['--host'] : []), 'xprop', '-spy', '-root', '_NET_ACTIVE_WINDOW']
            : ['-spy', '-root', '_NET_ACTIVE_WINDOW'];

        this.child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });

        let buffer = '';
        this.child.stdout?.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                const match = line.match(/window id # (0x[0-9a-f]+)/i);
                if (match) {
                    this.resolveWindowClass(match[1]);
                }
            }
        });

        this.child.on('exit', () => {
            this.child = null;
            // Reintentar en 5 segundos si el proceso muere inesperadamente
            setTimeout(() => this.startX11Watcher(), 5000);
        });
    }

    private async resolveWindowClass(windowId: string) {
        try {
            const result = await hostShell(`xprop -id ${windowId} WM_CLASS 2>/dev/null`);
            // WM_CLASS(STRING) = "code", "Code"  →  extraer el nombre fácil
            const match = result.match(/= "([^"]+)"/);
            const cls = match?.[1] || null;
            
            if (cls && cls !== this.currentClass) {
                this.currentClass = cls;
                this.emit('window-changed', cls);
            }
        } catch { /* ignorar */ }
    }
}
```

### WW-02: Solaar fast apply (sin reinicio para window watcher)

**Archivo nuevo**: `scripts/apply-solaar-fast.sh`

```bash
#!/usr/bin/env bash
# Aplica solo divert-keys via `solaar config` (no reinicia Solaar)
# Para usar cuando solo cambian los divert-keys (cambio de ventana/perfil)
set -euo pipefail

DEVICE="$1"        # nombre o número de dispositivo
DIVERT_MAP="$2"    # formato Solaar: "{83: 2, 86: 2, 253: 0}"

solaar config "$DEVICE" divert-keys "$DIVERT_MAP"
echo "OK — divert-keys applied without restart"
```

**Archivo actualizado**: `server/services/profileApplier.ts`

Agregar `applyProfileFast()` para el caso del window watcher:
- Si solo cambian los `divert-keys` → usar `apply-solaar-fast.sh`
- Si cambian las reglas → usar `apply-solaar.sh` completo (con restart)

**Detección de cambio de reglas:**
```typescript
function rulesChanged(prev: Profile, next: Profile): boolean {
    // Comparar serialización de buttons como JSON
    return JSON.stringify(prev.buttons) !== JSON.stringify(next.buttons);
}
```

---

## Scope Excluido

- Soporte nativo de Wayland (requiere investigación específica por compositor)
- Worker en C compilado (innecesario dado que `xprop -spy` es equivalente)
- Recarga en caliente de `rules.yaml` (no soportada por Solaar — requeriría parchar Solaar mismo)

---

## Archivos a Modificar / Crear

- `server/services/windowWatcher.ts` — reemplazar polling con `xprop -spy`
- `server/services/profileApplier.ts` — agregar `applyProfileFast()` y detección de cambio de reglas
- `scripts/apply-solaar-fast.sh` — **nuevo** script de fast-apply sin restart
- `server/routes/config.ts` — usar `applyProfileFast()` cuando sea apropiado
