# Spec 09 — Distribución de LogiTux como app de escritorio

## Contexto

LogiTux corre como una aplicación web local:
- **Backend**: servidor Express en Node.js (puerto 3001)
- **Frontend**: React + Vite, build estático servido por Express desde producción

La app **no usa Electron**. Node.js ya está disponible en cualquier Linux moderno, por lo que no hace falta empaquetar un runtime. La experiencia de usuario objetivo es:

- Se instala con `dnf`, `apt` o `brew`
- Tiene ícono en el menú de aplicaciones
- Puede iniciarse al arrancar la PC (XDG autostart)
- Abre el browser automáticamente al lanzarse
- Detecta y puede iniciar Solaar sin que el usuario intervenga

---

## Cómo se usa

```bash
# Lanzar la app (abre el browser en http://localhost:3001)
logitux

# Sin abrir el browser (para autostart en background)
logitux --no-browser
```

## Arquitectura

```
bin/logitux   (shell script)
     │
     ├── abre xdg-open http://localhost:3001  (en background)
     └── exec node dist-server/index.js       (bloquea, Ctrl+C para cerrar)
```

El servidor Express sirve el build estático de React y expone la API REST. No hay runtime embebido — Node.js es una dependencia del sistema.

---

## Objetivos

1. **Compilación del servidor**: `tsconfig.server.json` + script `build:server`
2. **Datos persistentes**: mover `data/logitux.db` a `~/.local/share/logitux/`
3. **Launcher**: `bin/logitux` que arranca el server y abre el browser
4. **Desktop entry**: ícono en el menú de aplicaciones + opción de autostart
5. **Gestión de Solaar**: detección de proceso, opción de levantar Solaar desde la app
6. **Instalación manual**: `install.sh` que copia todo a `/opt/logitux/`
7. **Distribución por paquetería**: RPM (dnf/COPR), DEB (apt/PPA), Homebrew

---

## Gestión de Solaar

`server/services/solaarDetector.ts` ya implementa detección (system + flatpak), `isSolaarRunning()` via `pgrep`, y `startSolaarMinimized()`. Solo hay que exponer endpoints y agregar el banner en el frontend.

**Banner de estado:**

| Situación | UI |
|---|---|
| Solaar no instalado | Banner rojo: "Solaar no detectado" |
| Instalado, no corriendo | Banner amarillo + botón "Iniciar Solaar" |
| Corriendo | Sin banner (estado normal) |

---

## Autostart

Vía XDG autostart (cross-DE: GNOME, KDE, XFCE, etc). El servidor agrega/elimina `~/.config/autostart/logitux.desktop` según la preferencia del usuario. Con `--no-browser` el server corre en background sin abrir el navegador.

---

## Desktop entry

`packaging/logitux.desktop` con `Terminal=true` — abre una terminal con los logs visibles. El usuario cierra con Ctrl+C.

---

## Distribución por paquetería

El flujo de release genera tres artefactos a partir del mismo tarball:

```
logitux-1.0.0.tar.gz   →   logitux-1.0.0-1.noarch.rpm
                        →   logitux_1.0.0_all.deb
                        →   (Homebrew apunta al tarball directamente)
```

Los usuarios instalan con:

```bash
# Fedora / RHEL / Bazzite
sudo dnf copr enable tu-usuario/logitux
sudo dnf install logitux

# Debian / Ubuntu
sudo apt install ./logitux_1.0.0_all.deb   # o via PPA

# macOS
brew tap tu-usuario/tap
brew install logitux
```

**Nota sobre `better-sqlite3`**: es un módulo nativo (C++). El tarball no es `noarch` real — se compila en la máquina de build. Para soportar múltiples arquitecturas hay que buildear en cada una.

---

## Archivos nuevos a crear

| Archivo | Propósito |
|---------|-----------|
| `tsconfig.server.json` | Compilar TS del servidor a JS |
| `bin/logitux` | Launcher script |
| `packaging/logitux.desktop` | Entrada para el menú de apps |
| `packaging/build-tarball.sh` | Genera tarball de release |
| `packaging/logitux.spec` | RPM spec para Fedora/RHEL |
| `packaging/build-rpm.sh` | Construir el RPM |
| `packaging/debian/control` | Metadatos del paquete DEB |
| `packaging/build-deb.sh` | Construir el DEB |
| `install.sh` | Instalar manual a `/opt/logitux/` |
| `uninstall.sh` | Desinstalar |

## Archivos existentes a modificar

| Archivo | Cambio |
|---------|--------|
| `server/db/index.ts` | `resolveDataDir()` — usa `~/.local/share/logitux/` en producción |
| `server/index.ts` | `LOGITUX_DIST_PATH` env var para resolver `dist/` en producción |
| `server/routes/preferences.ts` | Endpoint `POST/GET /api/preferences/autostart` |
| `package.json` | Scripts: `build:server`, `build:all`, `build:tarball`, `build:rpm`, `build:deb` |

---

## Scope excluido

- Electron / Tray icon / BrowserWindow
- SEA (Node Single Executable Application)
- AppImage / Flatpak / Snap
- Auto-actualización
- Firma de paquetes
- Soporte Windows / macOS nativo (Solaar es Linux-only; Homebrew es best-effort)
