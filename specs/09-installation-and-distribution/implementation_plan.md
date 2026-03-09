# Spec 09 — Implementation Plan: Distribución como app de escritorio

## Resumen

La app ya funciona: Express sirve React y expone API. Lo único que falta es:

1. Poder compilar el server TS a JS para producción
2. Que al arrancar abra el browser automáticamente
3. Datos persistentes en `~/.local/share/logitux/`
4. Opción de autostart al login
5. Un `.desktop` file para lanzar desde el menú de aplicaciones

No se necesita SEA, ni Electron, ni empaquetar binarios. Node.js ya está instalado en el sistema (requisito). La app se ejecuta con `node` y punto.

---

## Cómo se va a usar

```bash
# Desde terminal:
logitux

# Qué pasa:
#   1. Arranca Express en puerto 3001
#   2. Abre el browser en http://localhost:3001
#   3. Logs visibles en la terminal
#   4. Ctrl+C para cerrar

# Autostart (sin browser):
logitux --no-browser
```

---

## Fase 1 — Compilar el servidor TS a JS

### 1.1 Crear `tsconfig.server.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist-server",
    "rootDir": "server",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["server/**/*.ts"],
  "exclude": ["server/**/__tests__/**"]
}
```

### 1.2 Script de build

```json
{
  "scripts": {
    "build:server": "tsc -p tsconfig.server.json && cp server/db/schema.sql dist-server/db/schema.sql"
  }
}
```

`schema.sql` se copia a mano porque `tsc` solo emite `.js`.

### 1.3 Verificar

```bash
npm run build:server
node dist-server/index.js
# Debe arrancar en http://localhost:3001
```

---

## Fase 2 — Directorio de datos persistentes

### 2.1 Migrar datos a `~/.local/share/logitux/`

Ahora la DB vive en `data/logitux.db` relativo al proyecto. Para producción, debe ir a una ruta fija del usuario:

```
~/.local/share/logitux/
├── logitux.db
├── logitux.db-wal
└── scripts/
```

### 2.2 Modificar `server/db/index.ts`

```typescript
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

function resolveDataDir(): string {
  if (process.env.LOGITUX_DATA_DIR) {
    return process.env.LOGITUX_DATA_DIR;
  }
  if (process.env.LOGITUX_DEV === 'true') {
    return resolve(__dirname, '../../data');
  }
  return resolve(homedir(), '.local/share/logitux');
}

const DATA_DIR = resolveDataDir();
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = resolve(DATA_DIR, 'logitux.db');
```

### 2.3 Dev sigue igual

```json
{
  "scripts": {
    "dev:server": "LOGITUX_DEV=true tsx watch server/index.ts"
  }
}
```

En dev usa `data/` local. En producción usa `~/.local/share/logitux/`.

---

## Fase 3 — Launcher script

### 3.1 Crear `bin/logitux`

Un shell script que arranca el servidor y abre el browser:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Resolver dónde está instalada la app
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-3001}"

# Abrir browser cuando el server esté listo (en background)
if [[ "${1:-}" != "--no-browser" ]]; then
  (
    for i in $(seq 1 30); do
      if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
        xdg-open "http://localhost:$PORT" 2>/dev/null &
        break
      fi
      sleep 0.3
    done
  ) &
fi

# Arrancar el server (bloquea, Ctrl+C para cerrar)
exec node dist-server/index.js
```

### 3.2 Ruta de dist configurable en `server/index.ts`

Para que el server encuentre el build de React desde cualquier directorio:

```typescript
const distPath = process.env.LOGITUX_DIST_PATH || resolve(__dirname, '../dist');
app.use(express.static(distPath));
```

El launcher no necesita setear esto — el `cd "$SCRIPT_DIR"` ya resuelve las rutas relativas correctamente.

---

## Fase 4 — Desktop entry + autostart

### 4.1 Desktop file

`packaging/logitux.desktop`:

```ini
[Desktop Entry]
Name=LogiTux
Comment=Logitech device configuration for Linux
Exec=/opt/logitux/bin/logitux
Icon=logitux
Type=Application
Terminal=true
Categories=Settings;HardwareSettings;
StartupNotify=false
```

`Terminal=true` = abre una terminal visible con los logs. El usuario cierra con Ctrl+C.

### 4.2 Autostart endpoint

Agregar en `server/routes/preferences.ts`:

```typescript
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

router.post('/api/preferences/autostart', (req, res) => {
  const { enabled } = req.body;
  const dir = resolve(homedir(), '.config/autostart');
  const file = resolve(dir, 'logitux.desktop');

  if (enabled) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `[Desktop Entry]
Type=Application
Name=LogiTux
Exec=/opt/logitux/bin/logitux --no-browser
Terminal=false
Hidden=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
`);
  } else {
    if (existsSync(file)) unlinkSync(file);
  }

  setPreference('autostart', enabled ? 'true' : 'false');
  res.json({ ok: true, enabled });
});

router.get('/api/preferences/autostart', (_req, res) => {
  const file = resolve(homedir(), '.config/autostart/logitux.desktop');
  res.json({ enabled: existsSync(file) });
});
```

Con `--no-browser` el server arranca pero no abre el navegador. El usuario accede manualmente cuando quiera.

### 4.3 Toggle de autostart en el frontend

Toggle en la sección de preferencias que llama a `POST /api/preferences/autostart`.

---

## Fase 5 — Detección de Solaar

### 5.1 Ya existe

`server/services/solaarDetector.ts` ya implementa:

- `detectSolaar()` — detecta system + flatpak
- `isSolaarRunning()` — via `pgrep`
- `startSolaarMinimized()`

No hay que cambiar nada.

### 5.2 Endpoint de status (si no existe)

```typescript
router.get('/api/solaar/status', async (_req, res) => {
  const status = await detectSolaar();
  res.json(status);
});

router.post('/api/solaar/start', async (_req, res) => {
  try {
    startSolaarMinimized();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});
```

### 5.3 Banner en el frontend

| Situación | Qué se muestra |
|---|---|
| No instalado | Banner rojo: "Solaar no detectado" |
| Instalado, no corriendo | Banner amarillo + botón "Iniciar" |
| Corriendo | Nada (estado normal) |

---

## Fase 6 — Script de instalación

### 6.1 `install.sh`

Copia todo a `/opt/logitux/` y crea symlinks:

```bash
#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/logitux"

echo "Instalando LogiTux en $INSTALL_DIR..."

# Build
npm run build
npm run build:server

# Copiar
sudo mkdir -p "$INSTALL_DIR"/{bin,dist,dist-server,node_modules}
sudo cp -r dist/* "$INSTALL_DIR/dist/"
sudo cp -r dist-server/* "$INSTALL_DIR/dist-server/"
sudo cp -r node_modules/better-sqlite3 "$INSTALL_DIR/node_modules/"
sudo cp -r node_modules/express "$INSTALL_DIR/node_modules/"
sudo cp -r node_modules/js-yaml "$INSTALL_DIR/node_modules/"
# Copiar todas las deps transitivas de express
for dep in $(node -e "console.log(Object.keys(require('./node_modules/express/package.json').dependencies||{}).join('\n'))"); do
  [ -d "node_modules/$dep" ] && sudo cp -r "node_modules/$dep" "$INSTALL_DIR/node_modules/"
done
sudo cp -r node_modules/bindings "$INSTALL_DIR/node_modules/" 2>/dev/null || true
sudo cp -r node_modules/file-uri-to-path "$INSTALL_DIR/node_modules/" 2>/dev/null || true

# Launcher
sudo cp bin/logitux "$INSTALL_DIR/bin/logitux"
sudo chmod +x "$INSTALL_DIR/bin/logitux"
sudo ln -sf "$INSTALL_DIR/bin/logitux" /usr/local/bin/logitux

# Desktop entry
sudo cp packaging/logitux.desktop /usr/share/applications/
[ -f assets/logitux.png ] && sudo cp assets/logitux.png /usr/share/icons/hicolor/256x256/apps/

echo "✓ Instalado. Ejecutá 'logitux' para iniciar."
```

### 6.2 `uninstall.sh`

```bash
#!/usr/bin/env bash
sudo rm -rf /opt/logitux
sudo rm -f /usr/local/bin/logitux
sudo rm -f /usr/share/applications/logitux.desktop
sudo rm -f /usr/share/icons/hicolor/256x256/apps/logitux.png
echo "✓ LogiTux desinstalado."
```

---

## Fase 7 — Empaquetado para distribución

El objetivo es que el usuario final instale con su package manager, sin clonar nada:

```bash
# Fedora / RHEL / Bazzite
sudo dnf install logitux

# Debian / Ubuntu
sudo apt install logitux

# macOS
brew install logitux/tap/logitux
```

### 7.1 Tarball de release

Antes de empaquetar, necesitamos un tarball con los artefactos de build. No se distribuye código fuente — solo lo compilado.

```bash
#!/usr/bin/env bash
# packaging/build-tarball.sh
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
NAME="logitux-${VERSION}"
OUT="release/${NAME}"

rm -rf "$OUT" "release/${NAME}.tar.gz"
mkdir -p "$OUT"/{bin,dist,dist-server}

# Build
npm run build:all

# Copiar artefactos
cp -r dist/* "$OUT/dist/"
cp -r dist-server/* "$OUT/dist-server/"
cp bin/logitux "$OUT/bin/"
cp package.json "$OUT/"
cp packaging/logitux.desktop "$OUT/"
[ -f assets/logitux.png ] && cp assets/logitux.png "$OUT/"

# Instalar solo dependencias de producción
cd "$OUT"
npm install --omit=dev --ignore-scripts
cd -

# Crear tarball
tar -czf "release/${NAME}.tar.gz" -C release "${NAME}"
rm -rf "$OUT"

echo "✓ release/${NAME}.tar.gz"
```

El tarball queda con esta estructura:

```
logitux-1.0.0/
├── bin/logitux
├── dist/              # React build (HTML/JS/CSS)
├── dist-server/       # Server JS compilado
├── node_modules/      # Solo producción
├── package.json
├── logitux.desktop
└── logitux.png
```

### 7.2 RPM — Fedora / RHEL / Bazzite

Crear `packaging/logitux.spec`:

```spec
Name:           logitux
Version:        1.0.0
Release:        1%{?dist}
Summary:        Logitech device configuration for Linux
License:        MIT
URL:            https://github.com/tu-usuario/logitux
Source0:        %{name}-%{version}.tar.gz

Requires:       nodejs >= 18
Recommends:     solaar
BuildArch:      noarch

# No compilamos nada, el tarball ya viene construido
%global debug_package %{nil}

%description
App web local para configurar dispositivos Logitech en Linux.
Arranca un servidor Express en localhost:3001 y abre el browser.

%prep
%setup -q

%install
mkdir -p %{buildroot}/opt/%{name}/{bin,dist,dist-server,node_modules}
mkdir -p %{buildroot}/%{_bindir}
mkdir -p %{buildroot}/%{_datadir}/applications
mkdir -p %{buildroot}/%{_datadir}/icons/hicolor/256x256/apps

# Copiar todo
cp -r dist/* %{buildroot}/opt/%{name}/dist/
cp -r dist-server/* %{buildroot}/opt/%{name}/dist-server/
cp -r node_modules/* %{buildroot}/opt/%{name}/node_modules/
cp package.json %{buildroot}/opt/%{name}/
install -m 755 bin/logitux %{buildroot}/opt/%{name}/bin/logitux

# Symlink en PATH
ln -sf /opt/%{name}/bin/logitux %{buildroot}/%{_bindir}/logitux

# Desktop entry
install -m 644 logitux.desktop %{buildroot}/%{_datadir}/applications/logitux.desktop

# Icono (si existe)
[ -f logitux.png ] && install -m 644 logitux.png %{buildroot}/%{_datadir}/icons/hicolor/256x256/apps/logitux.png

%files
/opt/%{name}/
%{_bindir}/logitux
%{_datadir}/applications/logitux.desktop
%{_datadir}/icons/hicolor/256x256/apps/logitux.png

%changelog
* Sun Mar 08 2026 Tu Nombre <tu@email.com> - 1.0.0-1
- Release inicial
```

Para construir el RPM:

```bash
# packaging/build-rpm.sh
#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")

# Primero generar el tarball
bash packaging/build-tarball.sh

# Preparar estructura rpmbuild
mkdir -p ~/rpmbuild/{SOURCES,SPECS}
cp "release/logitux-${VERSION}.tar.gz" ~/rpmbuild/SOURCES/
cp packaging/logitux.spec ~/rpmbuild/SPECS/

# Construir
rpmbuild -bb ~/rpmbuild/SPECS/logitux.spec

echo "✓ RPM en ~/rpmbuild/RPMS/"
```

Para publicar en COPR (repo dnf público):

1. Crear cuenta en copr.fedorainfracloud.org
2. Crear proyecto "logitux"
3. Subir el SRPM o configurar webhook desde GitHub
4. Los usuarios agregan el repo: `sudo dnf copr enable tu-usuario/logitux`

### 7.3 DEB — Debian / Ubuntu

Crear directorio `packaging/debian/`:

**`packaging/debian/control`**:

```
Package: logitux
Version: 1.0.0
Section: utils
Priority: optional
Architecture: all
Depends: nodejs (>= 18)
Recommends: solaar
Maintainer: Tu Nombre <tu@email.com>
Description: Logitech device configuration for Linux
 App web local para configurar dispositivos Logitech.
 Arranca Express en localhost:3001 y abre el browser.
```

**`packaging/build-deb.sh`**:

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
PKG="logitux_${VERSION}_all"

# Build tarball primero
bash packaging/build-tarball.sh

# Preparar estructura .deb
rm -rf "release/$PKG"
mkdir -p "release/$PKG"/{DEBIAN,opt/logitux,usr/bin,usr/share/applications,usr/share/icons/hicolor/256x256/apps}

# Extraer tarball
tar -xzf "release/logitux-${VERSION}.tar.gz" -C /tmp
cp -r "/tmp/logitux-${VERSION}/"* "release/$PKG/opt/logitux/"
rm -rf "/tmp/logitux-${VERSION}"

# Control file
cp packaging/debian/control "release/$PKG/DEBIAN/control"

# Symlink
ln -sf /opt/logitux/bin/logitux "release/$PKG/usr/bin/logitux"

# Desktop + icono
mv "release/$PKG/opt/logitux/logitux.desktop" "release/$PKG/usr/share/applications/" 2>/dev/null || true
mv "release/$PKG/opt/logitux/logitux.png" "release/$PKG/usr/share/icons/hicolor/256x256/apps/" 2>/dev/null || true

# Construir .deb
dpkg-deb --build "release/$PKG"
rm -rf "release/$PKG"

echo "✓ release/${PKG}.deb"
```

Para publicar: subir el `.deb` a GitHub Releases o a un PPA.

### 7.4 Homebrew — macOS

Crear repo `homebrew-tap` con la Formula:

**`Formula/logitux.rb`** (en repo separado `tu-usuario/homebrew-tap`):

```ruby
class Logitux < Formula
  desc "Logitech device configuration for Linux/macOS"
  homepage "https://github.com/tu-usuario/logitux"
  url "https://github.com/tu-usuario/logitux/releases/download/v1.0.0/logitux-1.0.0.tar.gz"
  sha256 "SHA256_DEL_TARBALL"
  license "MIT"

  depends_on "node"

  def install
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/logitux"
  end

  test do
    assert_match "logitux", shell_output("#{bin}/logitux --version 2>&1", 0)
  end
end
```

Instalar:

```bash
brew tap tu-usuario/tap
brew install logitux
```

### 7.5 GitHub Release como hub de distribución

El flujo completo:

1. Tagear: `git tag v1.0.0 && git push --tags`
2. GitHub Action (o manual) ejecuta:
   - `build-tarball.sh` → `logitux-1.0.0.tar.gz`
   - `build-rpm.sh` → `logitux-1.0.0-1.noarch.rpm`
   - `build-deb.sh` → `logitux_1.0.0_all.deb`
3. Subir los 3 a GitHub Releases
4. COPR apunta al SRPM, Homebrew apunta al tarball

Opcional: agregar un GitHub Actions workflow en `.github/workflows/release.yml` que automatice todo esto al pushear un tag.

### 7.6 Nota sobre `noarch` y native modules

`better-sqlite3` es un módulo nativo (C++). Esto tiene implicaciones:

- El tarball **NO es portable entre arquitecturas**. Se compila en la máquina de build.
- Para RPM: si se quiere soportar x86_64 + aarch64, hay que buildear en cada arch (o usar `BuildArch: x86_64` en vez de `noarch`).
- Alternativa: marcar el paquete como arch-specific y que el `%install` haga `npm rebuild better-sqlite3`.
- Para Homebrew: `brew install` baja el tarball y puede hacer `npm rebuild` en el `post_install`.

Si esto se vuelve complicado, considerar reemplazar `better-sqlite3` por `sql.js` (WASM, sin compilación nativa) en el futuro.

---

## Orden de implementación

| # | Qué | Depende de |
|---|-----|------------|
| 1 | `tsconfig.server.json` + `build:server` | Nada |
| 2 | `resolveDataDir()` en `server/db/index.ts` | 1 |
| 3 | `bin/logitux` launcher script | 1 |
| 4 | Autostart endpoint + toggle UI | 3 |
| 5 | Endpoints Solaar + banner | Independiente |
| 6 | `install.sh` + `.desktop` file | 1, 3 |
| 7 | Tarball + RPM `.spec` + DEB + Homebrew Formula | 6 |

---

## Archivos nuevos a crear

| Archivo | Propósito |
|---------|-----------|
| `tsconfig.server.json` | Compilación TS del servidor |
| `bin/logitux` | Shell script launcher |
| `packaging/logitux.desktop` | Entrada para el menú de apps |
| `packaging/build-tarball.sh` | Genera tarball de release |
| `packaging/logitux.spec` | RPM spec para Fedora/RHEL |
| `packaging/build-rpm.sh` | Script helper para construir RPM |
| `packaging/debian/control` | Metadatos del paquete DEB |
| `packaging/build-deb.sh` | Script helper para construir DEB |
| `install.sh` | Instala manual en `/opt/logitux/` |
| `uninstall.sh` | Desinstala |

## Archivos existentes a modificar

| Archivo | Cambio |
|---------|--------|
| `server/db/index.ts` | `resolveDataDir()` para usar `~/.local/share/logitux/` en prod |
| `server/index.ts` | `LOGITUX_DIST_PATH` env var (opcional) |
| `package.json` | Agregar `build:server`, `build:all`, `build:tarball`, `build:rpm`, `build:deb` |
| `server/routes/preferences.ts` | Endpoints de autostart |

## Repos adicionales (para Homebrew)

| Repo | Propósito |
|------|-----------|
| `tu-usuario/homebrew-tap` | Contiene `Formula/logitux.rb` — se crea cuando se quiera publicar en Homebrew |

---

## Scripts en `package.json`

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "LOGITUX_DEV=true tsx watch server/index.ts",
    "dev:client": "vite",
    "dev:cloud": "concurrently \"MOCK_MODE=true LOGITUX_DEV=true tsx watch server/index.ts\" \"vite\"",
    "build": "vite build",
    "build:server": "tsc -p tsconfig.server.json && cp server/db/schema.sql dist-server/db/schema.sql",
    "build:all": "npm run build && npm run build:server",
    "build:tarball": "bash packaging/build-tarball.sh",
    "build:rpm": "bash packaging/build-rpm.sh",
    "build:deb": "bash packaging/build-deb.sh",
    "start": "node dist-server/index.js",
    "install:app": "bash install.sh",
    "test": "jest --verbose",
    "test:coverage": "jest --coverage --verbose"
  }
}
```

