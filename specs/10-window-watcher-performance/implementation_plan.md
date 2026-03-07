# Spec 10 — Implementation Plan: Window Watcher Performance + Solaar Hot-Reload

## Fase 1 — WindowWatcher event-driven con `xprop -spy`

### 1.1 Reescribir `server/services/windowWatcher.ts`

Reemplazar el `setInterval` de 2 segundos con un proceso `xprop -spy` permanente. La nueva clase mantiene la misma interfaz pública (`start()`, `stop()`, `getCurrentClass()`, emit `'window-changed'`) para no romper nada en `server/index.ts`.

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import EventEmitter from 'node:events';
import { USE_HOST_SPAWN, HOST_SPAWN_BIN, hostShell } from './solaarDetector.js';

export class WindowWatcher extends EventEmitter {
    private child: ChildProcess | null = null;
    private currentClass: string | null = null;
    private retryTimer: NodeJS.Timeout | null = null;
    private fallbackInterval: NodeJS.Timeout | null = null;

    start() {
        if (this.child || this.fallbackInterval) return;

        if (this.isX11Available()) {
            this.startX11Watcher();
        } else {
            console.warn('[WindowWatcher] Wayland detected or DISPLAY not set — using 2s polling fallback');
            this.startFallback();
        }
    }

    stop() {
        this.child?.kill();
        this.child = null;
        if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
        if (this.fallbackInterval) { clearInterval(this.fallbackInterval); this.fallbackInterval = null; }
    }

    getCurrentClass(): string | null {
        return this.currentClass;
    }

    private isX11Available(): boolean {
        // DISPLAY debe estar seteada para que xprop funcione
        // Funciona tanto en X11 puro como en XWayland
        return !!process.env.DISPLAY;
    }

    private startX11Watcher() {
        const cmd = USE_HOST_SPAWN ? HOST_SPAWN_BIN : 'xprop';
        const baseArgs = ['-spy', '-root', '_NET_ACTIVE_WINDOW'];
        const args = USE_HOST_SPAWN
            ? (HOST_SPAWN_BIN === 'flatpak-spawn'
                ? ['--host', 'xprop', ...baseArgs]
                : ['xprop', ...baseArgs])
            : baseArgs;

        this.child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });

        let buf = '';
        this.child.stdout?.on('data', (data: Buffer) => {
            buf += data.toString();
            const lines = buf.split('\n');
            buf = lines.pop() || '';

            for (const line of lines) {
                // _NET_ACTIVE_WINDOW(WINDOW): window id # 0x3e00004
                const match = line.match(/window id # (0x[0-9a-f]+)/i);
                if (match) {
                    this.resolveWindowClass(match[1]);
                }
            }
        });

        this.child.on('exit', (code) => {
            this.child = null;
            if (code !== null && code !== 0) {
                // xprop no disponible en el host — caer back a polling
                console.warn('[WindowWatcher] xprop exited, falling back to polling');
                this.startFallback();
            } else {
                // Reintentar normalmente (e.g. display server reiniciado)
                this.retryTimer = setTimeout(() => this.startX11Watcher(), 5000);
            }
        });
    }

    private async resolveWindowClass(windowId: string) {
        try {
            const result = await hostShell(`xprop -id ${windowId} WM_CLASS 2>/dev/null`);
            // WM_CLASS(STRING) = "Navigator", "firefox"
            // Queremos el segundo valor (nombre de clase)
            const match = result.match(/"([^"]+)"\s*$/);
            const cls = match?.[1] ?? null;

            if (cls && cls !== this.currentClass) {
                this.currentClass = cls;
                this.emit('window-changed', cls);
            }
        } catch {
            // Ventana cerrada antes de poder resolverla — ignorar
        }
    }

    private startFallback() {
        this.fallbackInterval = setInterval(() => this.pollFallback(), 2000);
        this.pollFallback();
    }

    private async pollFallback() {
        try {
            const result = await hostShell('xdotool getactivewindow getwindowclassname 2>/dev/null');
            const cls = result.trim() || null;
            if (cls && cls !== this.currentClass) {
                this.currentClass = cls;
                this.emit('window-changed', cls);
            }
        } catch { /* ignorar */ }
    }
}

export const windowWatcher = new WindowWatcher();
```

**Puntos clave:**
- Si `xprop` no está disponible (o el proceso muere), cae automáticamente al polling existente
- `resolveWindowClass()` hace UN solo spawn de `xprop` por cambio de ventana, en lugar de uno cada 2 segundos
- Compatible con flatpak-spawn / distrobox-host-exec via el mismo `USE_HOST_SPAWN` ya existente

---

## Fase 2 — Solaar Hot-Reload

### 2.1 Nuevo script `scripts/apply-solaar-fast.sh`

```bash
#!/usr/bin/env bash
# apply-solaar-fast.sh — Aplica divert-keys SIN reiniciar Solaar
# Usa `solaar config` que se comunica con la instancia en ejecución via D-Bus.
#
# Uso: apply-solaar-fast.sh <install_type> <device_name> <divert_keys_json>
# Ejemplo: apply-solaar-fast.sh system "LIFT" "{83: 2, 86: 0}"
set -euo pipefail

INSTALL_TYPE="${1:-system}"
DEVICE="${2}"
DIVERT_MAP="${3}"  # formato Solaar: {83: 2, 86: 0, 253: 0}

SOLAAR_CMD="solaar"
if [[ "$INSTALL_TYPE" == "flatpak" ]]; then
    SOLAAR_CMD="flatpak run io.github.pwr_solaar.solaar"
fi

$SOLAAR_CMD config "$DEVICE" divert-keys "$DIVERT_MAP" 2>&1
echo "OK — divert-keys applied (no restart)"
```

**Importante**: Este script requiere que Solaar esté corriendo. Si no está activo, falla con error — el caller debe checkear primero.

---

### 2.2 Actualizar `server/services/profileApplier.ts`

Agregar una función `applyProfileFast()` para usar en el window watcher:

```typescript
/** 
 * Aplica solo los divert-keys del perfil sin reiniciar Solaar.
 * Usar cuando solo cambia el perfil activo (ventana), no las reglas.
 * Retorna false si Solaar no está corriendo o si la versión no soporta el CLI.
 */
export async function applyProfileFast(
    profile: Profile, 
    deviceName: string, 
    installType: string
): Promise<boolean> {
    // Construir mapa de divert-keys en formato Solaar: {83: 2, 86: 0}
    const divertMap: Record<number, number> = {};
    for (const btn of profile.buttons) {
        if (btn.gestureMode) {
            divertMap[btn.cid] = 2;
        } else if (btn.simpleAction && btn.simpleAction.type !== 'None') {
            divertMap[btn.cid] = 2; // mode 2 para SimpleAction (fix BUG-01 de spec07)
        } else {
            divertMap[btn.cid] = 0;
        }
    }

    const divertJson = JSON.stringify(divertMap)
        .replace(/"/g, '');  // Solaar espera {83: 2} no {"83": 2}

    try {
        await runScript('apply-solaar-fast.sh', [installType, deviceName, divertJson]);
        console.log(`[Fast Apply] Profile ${profile.name} divert-keys applied`);
        return true;
    } catch (err) {
        console.warn('[Fast Apply] Failed — falling back to full apply:', err);
        return false;
    }
}

/**
 * Detecta si las reglas cambiaron entre dos versiones de un perfil.
 * Solo compara la parte de `buttons` (que genera las rules.yaml).
 */
export function profileRulesChanged(prev: Profile | null, next: Profile): boolean {
    if (!prev) return true;
    // Comparar serializando solo la parte relevante
    const serialize = (p: Profile) => JSON.stringify(
        p.buttons.map(b => ({ gestureMode: b.gestureMode, gestures: b.gestures, simpleAction: b.simpleAction }))
    );
    return serialize(prev) !== serialize(next);
}
```

---

### 2.3 Actualizar el handler de window-changed en `server/index.ts`

```typescript
// Guardar el perfil anterior para comparar reglas
let previousProfile: Profile | null = null;

windowWatcher.on('window-changed', async (windowClass: string) => {
    const { getAllProfiles } = await import('./routes/profiles.js');
    const { applyProfileFast, applyProfileToSolaar, profileRulesChanged } = await import('./services/profileApplier.js');
    
    const profiles = await getAllProfiles();
    const status = await detectSolaar();
    
    // Encontrar perfil para la ventana activa
    const profile = profiles.find(p => p.windowClasses?.includes(windowClass))
        ?? profiles.find(p => p.name.toLowerCase() === 'default');
    
    if (!profile || !status.installed) return;

    const rulesNeedUpdate = profileRulesChanged(previousProfile, profile);
    
    if (rulesNeedUpdate) {
        // Reglas cambiaron → full restart necesario
        console.log(`[WindowWatcher] Rules changed for profile ${profile.name} — full apply`);
        await applyProfileToSolaar(profile);
    } else {
        // Solo divert-keys cambiaron (o mismo perfil base) → fast apply
        const fastOk = await applyProfileFast(profile, profile.deviceName, status.installType);
        if (!fastOk) {
            // Fallback a full apply si el fast apply falla
            await applyProfileToSolaar(profile);
        }
    }
    
    previousProfile = profile;
});
```

---

## Fase 3 — Actualizar `ALLOWED_SCRIPTS` en `scriptRunner.ts`

Agregar `apply-solaar-fast.sh` a la lista de scripts permitidos (hasta que se resuelva el fix de spec08 que dinamiza la whitelist):

```typescript
const ALLOWED_SCRIPTS = [
    'apply-solaar.sh',
    'apply-solaar-fast.sh',  // ← nuevo
    'reset-solaar.sh',
    'monitor-colors.sh',
    'volume.sh',
    'brightness.sh',
    'nightshift.sh'
];
```

---

## Orden de Implementación

1. `server/services/windowWatcher.ts` — reescribir con `xprop -spy` (self-contained, no rompe nada)
2. `scripts/apply-solaar-fast.sh` — nuevo script bash (bajo riesgo)
3. `server/services/scriptRunner.ts` — agregar `apply-solaar-fast.sh` a whitelist
4. `server/services/profileApplier.ts` — agregar `applyProfileFast()` y `profileRulesChanged()`
5. `server/index.ts` — actualizar el handler `window-changed` para usar fast apply
6. Tests:
   - `windowWatcher.test.ts` — mockear `spawn` para verificar que usa `xprop -spy` en X11
   - `windowWatcher.test.ts` — verificar fallback a polling cuando `DISPLAY` no está seteada
   - `profileApplier.test.ts` — tests para `profileRulesChanged()`

---

## Métricas de Mejora Esperadas

| Métrica | Antes | Después |
|---|---|---|
| Latencia de cambio de ventana | 0–2000ms | 10–50ms |
| Spawns de proceso en idle (por minuto) | 30 (`xdotool` cada 2s) | 0 |
| Spawns de proceso al cambiar ventana | 1 | 1–2 (xprop resolve class) |
| Tiempo de cambio de perfil (window watcher) | 3–4s (restart Solaar) | ~200ms (fast apply) |
| Tiempo de cambio de perfil (usuario edita) | 3–4s (restart Solaar) | 3–4s (necesario si rules cambian) |

## Notas

- `solaar config <device> divert-keys` **requiere que Solaar esté activo** para funcionar. En el caso de que Solaar no esté corriendo, el fast apply falla silenciosamente y el sistema cae back al apply completo.
- Los keycodes de `_NET_ACTIVE_WINDOW` en Wayland puro (`WAYLAND_DISPLAY` seteada sin `DISPLAY`) se resuelven diferente. En XWayland (la mayoría de los casos prácticos), `DISPLAY` está seteada y `xprop -spy` funciona normalmente.
- **No** modificar `apply-solaar.sh` existente — es el path de código probado para la aplicación completa de perfiles.
