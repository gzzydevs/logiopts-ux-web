# Spec 13 — Wayland Support for WindowWatcher

## Context

LogiTux uses a `WindowWatcher` service to detect the currently focused desktop window and automatically switch Logitech mouse profiles based on the active application.

The current implementation runs:
```bash
xdotool getactivewindow getwindowclassname 2>/dev/null
```
every 2 seconds via `setInterval`.

**This crashes on Wayland** with exit code 134 (SIGABRT / core dump), because `xdotool` is an X11-only tool. Even though `$DISPLAY=:0` is set (XWayland is running), `xdotool getactivewindow` crashes whenever a **native Wayland window** is in focus — it cannot obtain an XWindow ID for Wayland-native apps.

The result is an infinite loop of crashing processes spamming the console:

```
[hostShell Debug] cmd: xdotool getactivewindow getwindowclassname 2>/dev/null
[hostShell Debug] err: 134
[hostShell Debug] stderr: bash: line 1: 2670576 Aborted (core dumped) xdotool ...
```

---

## Environment

- OS: Linux (Bazzite — KDE spin, based on Fedora Kinoite)
- Compositor: **KDE Plasma 6, Wayland** (`XDG_SESSION_TYPE=wayland`)
- XWayland: available but not sufficient for native Wayland apps
- Container: Node.js server runs **inside Flatpak/Distrobox** — all host commands go through `hostShell()` which wraps with `flatpak-spawn --host` when needed

---

## Goal

Refactor `WindowWatcher` to support multiple display server backends, selecting the correct one at startup based on the detected environment. The public API must remain identical (`start()`, `stop()`, `getCurrentClass()`, `'window-changed'` event).

---

## What To Build

### 1. `WindowBackend` interface — `server/services/windowBackend.ts`

```typescript
export interface WindowBackend {
  readonly name: string;
  start(): void;
  stop(): void;
  onWindowChanged(cb: (className: string) => void): void;
}
```

---

### 2. `X11Backend` — `server/services/backends/x11Backend.ts`

Use `xprop -spy -root _NET_ACTIVE_WINDOW` (already designed in Spec 10 but never extracted). This spawns a **persistent process** that streams events; CPU usage is ~0 in idle.

When a new `_NET_ACTIVE_WINDOW` value arrives, resolve the WM_CLASS with:
```bash
xprop -id <window_id> WM_CLASS 2>/dev/null
```
Extract the second string from `WM_CLASS(STRING) = "instance", "ClassName"` and lowercase it.

Must respect `USE_HOST_SPAWN` / `HOST_SPAWN_BIN` from `solaarDetector.ts` for Flatpak/Distrobox compat.

---

### 3. `WaylandKDEBackend` — `server/services/backends/waylandKdeBackend.ts`

**Primary strategy** — event-driven via `dbus-monitor`:

```bash
dbus-monitor --session "type=signal,interface=org.kde.KWin,member=windowActivated"
```

When a signal arrives, fetch the active window class with two `qdbus6` calls:

```bash
# Step 1: get active window UUID
qdbus6 org.kde.KWin /KWin activeWindow
# → "c3de5fce-4c13-4bb9-87a5-c2af38f6d62c"

# Step 2: get WM class from the window object
qdbus6 org.kde.KWin /KWin/Window/<uuid> resourceClass
# → "firefox"
```

**Fallback strategy** — if `dbus-monitor` is unavailable / exits unexpectedly: poll with the same `qdbus6` pair every 3 seconds.

---

### 4. `WaylandGNOMEBackend` — `server/services/backends/waylandGnomeBackend.ts`

GNOME Wayland doesn't expose a stable D-Bus signal for focus changes without extensions.
Use **polling every 3 seconds** via:

```bash
gdbus call --session --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Introspect \
  --method org.gnome.Shell.Introspect.GetRunningApplications 2>/dev/null
```

Parse the output to find the app with `'focused': true`. Extract the last segment of the app ID and lowercase it (e.g. `"org.gnome.Nautilus"` → `"nautilus"`).

---

### 5. `FallbackBackend` — `server/services/backends/fallbackBackend.ts`

A no-op backend for unknown/headless environments.

- `start()`: log a single `[WindowWatcher] No compatible window backend found. Per-app profile switching is disabled.`
- `stop()`: no-op
- No polling, no spawns, no CPU usage

---

### 6. Refactor `WindowWatcher` — `server/services/windowWatcher.ts`

Replace the current `setInterval` + `xdotool` implementation with:

```typescript
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
```

#### Session type detection

```typescript
async function detectSessionType(): Promise<'x11' | 'wayland-kde' | 'wayland-gnome' | 'unknown'> {
  const session = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
  const desktop = (process.env.XDG_CURRENT_DESKTOP || '').toLowerCase();

  if (!session || session === 'x11') return 'x11';

  if (session === 'wayland') {
    if (desktop.includes('kde') || process.env.KDE_FULL_SESSION) return 'wayland-kde';
    if (desktop.includes('gnome') || process.env.GNOME_DESKTOP_SESSION_ID) return 'wayland-gnome';

    // Fallback: probe via D-Bus
    const kwin = await hostShell('qdbus6 org.kde.KWin / 2>/dev/null | head -1').catch(() => '');
    if (kwin.trim()) return 'wayland-kde';

    const gnome = await hostShell(
      'gdbus introspect --session --dest org.gnome.Shell --object-path /org/gnome/Shell 2>/dev/null | head -1'
    ).catch(() => '');
    if (gnome.trim()) return 'wayland-gnome';
  }

  return 'unknown';
}
```

---

### 7. Update `server/index.ts`

`start()` is now `async`. Update the call site:

```typescript
// Before:
windowWatcher.start();

// After:
await windowWatcher.start();
```

---

### 8. Add startup diagnostics

Expand the existing `[DIAGNOSTICS]` block in `server/index.ts` to log:

```
[DIAGNOSTICS] XDG_SESSION_TYPE: wayland
[DIAGNOSTICS] XDG_CURRENT_DESKTOP: KDE
[DIAGNOSTICS] has qdbus6: true
[DIAGNOSTICS] has dbus-monitor: true
[DIAGNOSTICS] has gdbus: true
```

---

### 9. Tests — `server/services/__tests__/windowWatcher.test.ts`

| Test case | Expected |
|-----------|----------|
| `XDG_SESSION_TYPE=x11` | `detectSessionType()` returns `'x11'` |
| `XDG_SESSION_TYPE=wayland` + `XDG_CURRENT_DESKTOP=KDE` | returns `'wayland-kde'` |
| `XDG_SESSION_TYPE=wayland` + `XDG_CURRENT_DESKTOP=GNOME` | returns `'wayland-gnome'` |
| No env vars set | returns `'unknown'` |
| Backend emits class | `WindowWatcher` emits `'window-changed'` with that class |
| Same class twice | `WindowWatcher` emits only once (dedup) |
| `stop()` | calls `backend.stop()` |

---

## Files Summary

| File | Action |
|------|--------|
| `server/services/windowBackend.ts` | Create — `WindowBackend` interface |
| `server/services/backends/x11Backend.ts` | Create — xprop -spy backend |
| `server/services/backends/waylandKdeBackend.ts` | Create — KDE D-Bus backend |
| `server/services/backends/waylandGnomeBackend.ts` | Create — GNOME gdbus backend |
| `server/services/backends/fallbackBackend.ts` | Create — no-op backend |
| `server/services/windowWatcher.ts` | Refactor — multi-backend dispatcher |
| `server/index.ts` | Patch — await start(), add diagnostics |
| `server/services/__tests__/windowWatcher.test.ts` | Create — unit tests |

---

## Constraints

- All shell commands MUST go through `hostShell()` or `hostExec()` from `solaarDetector.ts` to maintain Flatpak/Distrobox compatibility
- No new npm dependencies
- Do not modify the public API of `WindowWatcher`
- Do not modify any routes, DB, or frontend code
- TypeScript strict mode is active — no implicit `any`
