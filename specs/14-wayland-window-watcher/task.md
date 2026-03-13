# Spec 13 — Wayland Support for WindowWatcher

## Problema

`WindowWatcher` usa `xdotool getactivewindow getwindowclassname` para detectar la ventana activa.
`xdotool` es una herramienta de X11 que **crashea con exit code 134 (SIGABRT)** en Wayland, incluso cuando XWayland está cargado (`$DISPLAY=:0`), porque las ventanas nativas de Wayland no tienen un XWindow ID válido.

### Síntoma en consola

```
[hostShell Debug] cmd: xdotool getactivewindow getwindowclassname 2>/dev/null
[hostShell Debug] err: 134
[hostShell Debug] stderr: bash: line 1: 2670576 Aborted (core dumped) xdotool ...
```

Esto genera un loop infinito de procesos crashados cada 2 segundos, llenando la consola y consumiendo CPU innecesariamente.

---

## Causa Raíz

El entorno del usuario es:
- `XDG_SESSION_TYPE=wayland`
- `WAYLAND_DISPLAY=wayland-0`
- `DISPLAY=:0` (XWayland disponible, pero solo para apps X11)

`xdotool getactivewindow` consulta la propiedad `_NET_ACTIVE_WINDOW` del root de X11. Cuando la ventana activa es una app nativa Wayland, el compositor no expone esta propiedad y xdotool coredumps.

---

## Objetivos

1. **Detectar el tipo de sesión** en tiempo de arranque (`x11` vs `wayland`) 
2. **Implementar un backend Wayland** que obtenga la ventana activa vía D-Bus
3. **Mantener el backend X11** existente (`xprop -spy`, event-driven, spec 10)
4. **Fallback silencioso**: si ningún backend funciona, logear una advertencia y no spamear errores
5. **Sin cambios en la API pública** de `WindowWatcher` (`start()`, `stop()`, `getCurrentClass()`, event `'window-changed'`)

---

## Requisitos Funcionales

| # | Requisito |
|---|-----------|
| RF-1 | Al arrancar, detectar si la sesión es X11 o Wayland via `XDG_SESSION_TYPE` |
| RF-2 | En Wayland + KDE Plasma: usar D-Bus (`qdbus6`) para obtener la clase de la ventana activa |
| RF-3 | En Wayland + GNOME: usar D-Bus (`gdbus`) para introspección de ventana activa |
| RF-4 | En X11: mantener comportamiento actual con `xprop -spy` o `xdotool` |
| RF-5 | Si el backend Wayland falla, bajar a fallback de polling sin crashear |
| RF-6 | No más `core dumped` ni spam de errores en consola |
| RF-7 | Intervalo de polling de fallback: 5 segundos (no 2) para reducir carga |

## Requisitos No Funcionales

| # | Requisito |
|---|-----------|
| RNF-1 | La detección de backend ocurre una sola vez al llamar `start()` |
| RNF-2 | En idle (sin cambios de ventana), el consumo de CPU debe ser ≈ 0 en los backends event-driven |
| RNF-3 | Compatible con Flatpak/Distrobox (usar `hostShell`/`hostExec` para los comandos D-Bus) |

---

## Compositors Soportados

| Compositor | Entorno | Backend |
|-----------|---------|---------|
| KDE Plasma 6 (Wayland) | Bazzite KDE, Fedora KDE, Arch KDE | `dbus-monitor` + `qdbus6` |
| GNOME (Wayland) | Fedora Workstation, Ubuntu, Bazzite GNOME | `gdbus call` (polling) |
| X11 / XWayland-only | X11, Xfce, entornos legacy | `xprop -spy` (event-driven) |
| Desconocido / Headless | CI, servidores | Fallback silencioso |
