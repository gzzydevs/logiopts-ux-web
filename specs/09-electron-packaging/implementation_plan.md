# Spec 09 — Implementation Plan: Node SEA Standalone Binary + Linux Packaging

## Justificación arquitectónica

### Problema con Electron

El plan anterior proponía envolver la aplicación en Electron. Esto introducía:

| Problema | Impacto |
|----------|---------|
| Chromium embebido (~200-300 MB) | Binario enorme, alto consumo de RAM |
| Main process + preload + IPC | Complejidad innecesaria — la app ya funciona como web local |
| electron-builder | Toolchain de build pesado y frágil |
| Acoplamiento a Electron runtime | Dificulta mantenimiento y debugging |

La aplicación **ya funciona** como local web app: Express sirve el build de React y expone API REST. No necesita un navegador embebido.

### Arquitectura elegida: Local Web App + Node SEA

```
usuario ejecuta ./logitux
  ↓
extrae assets a /tmp/logitux-assets/ (si es SEA)
  ↓
servidor Express se inicia (puerto 3001)
  ↓
abre navegador del sistema en http://localhost:3001
  ↓
UI React se carga normalmente
  ↓
SQLite en ~/.local/share/logitux/logitux.db
```

**Ventajas sobre Electron:**

| Aspecto | Electron | Node SEA |
|---------|----------|----------|
| Tamaño binario | ~200-300 MB | ~60-80 MB |
| RAM en uso | ~300-500 MB | ~40-80 MB |
| Complejidad | Main + renderer + preload + IPC | Un solo proceso Node |
| Dependencias build | electron-builder, muchas deps | Solo Node.js nativo |
| Debugging | DevTools de Electron | Terminal + browser DevTools |
| Mantenibilidad | Alta complejidad | Mínima complejidad |
| Portabilidad web | Requiere adaptación | Funciona idéntico en browser |

### ¿Qué es Node SEA?

Node.js Single Executable Applications (SEA) es una funcionalidad nativa de Node.js (≥20) que permite:

1. Empaquetar código JS + assets dentro del propio binario de Node
2. Generar un ejecutable que **no requiere Node instalado**
3. Sin dependencias externas (no pkg, no nexe)

Limitaciones a considerar:
- Solo empaqueta un blob binario (no un filesystem virtual)
- Los assets deben extraerse a disco para `express.static`
- Módulos nativos (como `better-sqlite3`) deben estar junto al binario

---

## Estructura final del proyecto

```
logitux-web/
├── server/                    # Backend Express (sin cambios)
│   ├── index.ts
│   ├── types.ts
│   ├── db/
│   ├── routes/
│   ├── services/
│   ├── solaar/
│   ├── state/
│   └── mock/
├── src/                       # Frontend React (sin cambios)
├── scripts/                   # Shell scripts de usuario
├── data/                      # DB local (dev only, ignorado en prod)
├── assets/
│   └── logitux.png            # Ícono de la aplicación
│
├── sea/                       # ★ NUEVO — Node SEA build system
│   ├── entry.ts               # Entry point del ejecutable standalone
│   ├── asset-extractor.ts     # Extrae assets del blob a /tmp
│   ├── browser-opener.ts      # Abre navegador del sistema
│   ├── sea-config.json        # Configuración de Node SEA
│   └── build.sh               # Script de build completo
│
├── packaging/                 # ★ NUEVO — Generación de .deb / .rpm / AppImage
│   ├── build-packages.sh      # Script maestro de packaging
│   ├── logitux.desktop        # Launcher para menú de aplicaciones
│   ├── deb/
│   │   └── control            # Metadatos del paquete .deb
│   ├── rpm/
│   │   └── logitux.spec       # Spec file para RPM
│   └── appimage/
│       ├── AppRun              # Entry point del AppImage
│       └── logitux.appdata.xml # Metadatos AppStream
│
├── dist/                      # Build de Vite (frontend)
├── dist-server/               # Build compilado del servidor
├── dist-sea/                  # ★ Output del build SEA
│   └── logitux                # Ejecutable final standalone
│
├── package.json
├── tsconfig.json
├── tsconfig.server.json       # ★ NUEVO — tsconfig para compilar server/
└── vite.config.ts
```

---

## Fase 1 — Compilación del servidor con TypeScript

### 1.1 Crear `tsconfig.server.json`

El servidor necesita su propia configuración de compilación para generar JS ejecutable por Node:

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

### 1.2 Agregar script de compilación

En `package.json`:

```json
{
  "scripts": {
    "build:server": "tsc -p tsconfig.server.json && cp server/db/schema.sql dist-server/db/schema.sql"
  }
}
```

**Nota**: `schema.sql` debe copiarse manualmente porque `tsc` solo emite `.js`.

### 1.3 Ajustar rutas en `server/db/index.ts`

El módulo de DB usa `__dirname` relativo para encontrar `schema.sql`.
En el build compilado esto seguirá funcionando porque la estructura de directorios se mantiene:

```
dist-server/
├── index.js
├── db/
│   ├── index.js
│   └── schema.sql          ← copiado en build
├── routes/
├── services/
├── ...
```

Para el binario SEA, `schema.sql` irá dentro del blob y se extraerá al directorio temporal.

### 1.4 Verificar que `npm run build:server && node dist-server/index.js` funciona

Antes de avanzar, confirmar que el servidor compilado arranca correctamente fuera de `tsx`.

---

## Fase 2 — Directorio de datos persistentes

### 2.1 Migrar datos a `~/.local/share/logitux/`

Actualmente la DB vive en `data/logitux.db` (relativo al proyecto). Para el binario standalone, los datos deben estar en una ubicación predecible:

```
~/.local/share/logitux/
├── logitux.db
├── logitux.db-wal
├── logitux.db-shm
└── scripts/
```

### 2.2 Nueva lógica de resolución de `DB_PATH`

Modificar `server/db/index.ts`:

```typescript
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

function resolveDataDir(): string {
  // 1. Variable de entorno explícita (dev/test override)
  if (process.env.LOGITUX_DATA_DIR) {
    return process.env.LOGITUX_DATA_DIR;
  }

  // 2. En modo desarrollo (cuando se ejecuta con tsx): usar data/ relativo
  if (process.env.NODE_ENV === 'development' || process.env.LOGITUX_DEV === 'true') {
    return resolve(__dirname, '../../data');
  }

  // 3. Producción: ~/.local/share/logitux/
  return resolve(homedir(), '.local/share/logitux');
}

const DATA_DIR = resolveDataDir();
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = resolve(DATA_DIR, 'logitux.db');
```

### 2.3 Resolución de `scripts/` persistentes

El `scriptsRouter` ya soporta paths configurables. Asegurar que los scripts de usuario se guarden en:

```
~/.local/share/logitux/scripts/
```

y no en el directorio del proyecto. La misma lógica `resolveDataDir()` aplica.

### 2.4 Mantener compatibilidad dev

Los scripts de desarrollo (`npm run dev:server`) deben seguir usando `data/` local:

```json
{
  "scripts": {
    "dev:server": "LOGITUX_DEV=true tsx watch server/index.ts"
  }
}
```

---

## Fase 3 — Entry point del ejecutable SEA

### 3.1 `sea/entry.ts` — Punto de entrada principal

Este es el script que se empaqueta dentro del binario SEA. Su responsabilidad:

1. Detectar si está corriendo como SEA
2. Extraer assets del frontend a un directorio temporal
3. Configurar variables de entorno
4. Iniciar el servidor Express
5. Abrir el navegador del sistema
6. Manejar señales de salida

```typescript
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import sea from 'node:sea';

const IS_SEA = sea.isSea();
const PORT = process.env.PORT || '3001';

// --- 1. Extraer assets del frontend ---
let distWebPath: string;

if (IS_SEA) {
  // En modo SEA, los assets están como blob dentro del binario
  distWebPath = resolve('/tmp', 'logitux-assets', 'dist');
  extractAssets(distWebPath);
} else {
  // En modo desarrollo, usar dist/ del proyecto
  distWebPath = resolve(__dirname, '../dist');
}

// Configurar variables de entorno para el servidor
process.env.LOGITUX_DIST_PATH = distWebPath;
process.env.PORT = PORT;

// --- 2. Importar y arrancar el servidor ---
// (dynamic import para que las env vars estén listas)
async function main() {
  await import('../dist-server/index.js');

  // --- 3. Abrir navegador ---
  if (!process.argv.includes('--no-browser')) {
    openBrowser(`http://localhost:${PORT}`);
  }

  console.log(`[LogiTux] Server running on http://localhost:${PORT}`);
  console.log(`[LogiTux] Press Ctrl+C to stop`);
}

main().catch(err => {
  console.error('[LogiTux] Fatal error:', err);
  process.exit(1);
});
```

### 3.2 `sea/asset-extractor.ts` — Extracción de assets

Node SEA permite incluir assets como "named blobs" usando la API `node:sea`:

```typescript
import sea from 'node:sea';
import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Los assets del front se empaquetan como un blob tar dentro del SEA binary.
 * Al iniciar, se extraen a /tmp/logitux-assets/ si no existen o si la versión cambió.
 */
export function extractAssets(targetDir: string): void {
  const versionFile = resolve(targetDir, '.version');
  const currentVersion = getAppVersion();

  // Skip si ya está extraído con la misma versión
  if (existsSync(versionFile)) {
    const extracted = readFileSync(versionFile, 'utf-8').trim();
    if (extracted === currentVersion) return;
  }

  console.log('[LogiTux] Extracting web assets...');

  // Obtener el blob del frontend empaquetado
  const assetBlob = sea.getAsset('frontend.tar', 'raw') as ArrayBuffer;
  const buffer = Buffer.from(assetBlob);

  // Extraer tar a disco
  mkdirSync(targetDir, { recursive: true });
  extractTarBuffer(buffer, targetDir);

  // Marcar versión
  writeFileSync(versionFile, currentVersion);
}
```

**Estrategia de empaquetado**: Los archivos del frontend (`dist/`) se empaquetan como un tar sin comprimir dentro del blob SEA. Al primer inicio, se extraen a `/tmp/logitux-assets/dist/`. Un archivo `.version` evita re-extracciones innecesarias.

### 3.3 `sea/browser-opener.ts` — Apertura de navegador

```typescript
import { exec } from 'node:child_process';

export function openBrowser(url: string): void {
  // xdg-open es el estándar en Linux para abrir URLs en el navegador default
  const child = exec(`xdg-open ${url}`, { timeout: 5000 });
  child.unref();
}
```

### 3.4 Modificar `server/index.ts` — Ruta de dist configurable

El servidor debe leer la ruta de archivos estáticos desde una variable de entorno:

```typescript
// Serve static React build
const distPath = process.env.LOGITUX_DIST_PATH || resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => {
  res.sendFile(resolve(distPath, 'index.html'));
});
```

Esto permite que:
- En dev: use `dist/` (build de Vite local)
- En SEA: use `/tmp/logitux-assets/dist/` (extraído del blob)

---

## Fase 4 — Build del binario SEA

### 4.1 `sea/sea-config.json`

Configuración para Node SEA:

```json
{
  "main": "dist-sea-bundle/entry.js",
  "output": "dist-sea/logitux.blob",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": true,
  "assets": {
    "frontend.tar": "dist-sea-bundle/frontend.tar"
  }
}
```

### 4.2 `sea/build.sh` — Script de build completo

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== LogiTux SEA Build ==="

# 1. Build frontend con Vite
echo "[1/7] Building frontend..."
npm run build

# 2. Build servidor con TypeScript
echo "[2/7] Building server..."
npx tsc -p tsconfig.server.json
cp server/db/schema.sql dist-server/db/schema.sql

# 3. Compilar entry point SEA
echo "[3/7] Building SEA entry..."
mkdir -p dist-sea-bundle
npx tsc sea/entry.ts sea/asset-extractor.ts sea/browser-opener.ts \
  --outDir dist-sea-bundle \
  --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --esModuleInterop --skipLibCheck

# 4. Copiar server compilado dentro del bundle
echo "[4/7] Assembling bundle..."
cp -r dist-server dist-sea-bundle/dist-server

# 5. Crear tar de assets del frontend
echo "[5/7] Packaging frontend assets..."
(cd dist && tar cf ../dist-sea-bundle/frontend.tar .)

# 6. Copiar node_modules necesarios (solo producción)
echo "[6/7] Copying production dependencies..."
# Node SEA no puede require() módulos nativos desde dentro del blob.
# better-sqlite3 y otros nativos van como archivos acompañantes.
mkdir -p dist-sea-bundle/node_modules
cp -r node_modules/better-sqlite3 dist-sea-bundle/node_modules/
cp -r node_modules/bindings dist-sea-bundle/node_modules/ 2>/dev/null || true
cp -r node_modules/file-uri-to-path dist-sea-bundle/node_modules/ 2>/dev/null || true
cp -r node_modules/express dist-sea-bundle/node_modules/
# Copiar todas las dependencias de express (transitivas)
for dep in $(node -e "
  const pkg = require('./node_modules/express/package.json');
  console.log(Object.keys(pkg.dependencies || {}).join('\n'));
"); do
  [ -d "node_modules/$dep" ] && cp -r "node_modules/$dep" dist-sea-bundle/node_modules/
done
# Copiar js-yaml (usado por solaar parser)
cp -r node_modules/js-yaml dist-sea-bundle/node_modules/

# 7. Generar blob y binario SEA
echo "[7/7] Generating standalone binary..."
mkdir -p dist-sea
node --experimental-sea-config sea/sea-config.json
cp "$(command -v node)" dist-sea/logitux
npx postject dist-sea/logitux NODE_SEA_BLOB dist-sea/logitux.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo ""
echo "✓ Build complete: dist-sea/logitux"
echo "  Size: $(du -h dist-sea/logitux | cut -f1)"
```

### 4.3 Problema con módulos nativos (better-sqlite3)

**Este es el punto más delicado del build SEA.**

Node SEA empaqueta código dentro del binario, pero **no puede cargar módulos nativos (.node)** desde el blob. `better-sqlite3` es un módulo nativo C++.

**Solución**: El binario `.node` de better-sqlite3 debe estar **junto al ejecutable** o en una ruta conocida:

```
/usr/lib/logitux/
├── logitux                      # Binario SEA
├── native/
│   └── better_sqlite3.node      # Módulo nativo
```

Modificar la resolución del módulo nativo en el entry point SEA:

```typescript
// En sea/entry.ts, antes de importar el servidor:
const nativeDir = resolve(dirname(process.execPath), 'native');
process.env.BETTER_SQLITE3_BINDING = resolve(nativeDir, 'better_sqlite3.node');
```

Y en `server/db/index.ts`, usar la variable de entorno si existe:

```typescript
import Database from 'better-sqlite3';

// En modo SEA, el binding se busca desde la variable de entorno
const options: Database.Options = {};
if (process.env.BETTER_SQLITE3_BINDING) {
  options.nativeBinding = process.env.BETTER_SQLITE3_BINDING;
}

const db = new Database(DB_PATH, options);
```

### 4.4 Agregar scripts al `package.json`

```json
{
  "scripts": {
    "build:server": "tsc -p tsconfig.server.json && cp server/db/schema.sql dist-server/db/schema.sql",
    "build:sea": "bash sea/build.sh",
    "build:all": "npm run build && npm run build:server && npm run build:sea"
  }
}
```

---

## Fase 5 — Detección de Solaar desde Express

### 5.1 Situación actual

El servicio `server/services/solaarDetector.ts` **ya implementa** toda la lógica necesaria:

- `detectSolaar()` — detecta instalación (system + flatpak) y estado (running/stopped)
- `isSolaarRunning()` — via `pgrep`
- `startSolaarMinimized()` — lanza Solaar en segundo plano

Estas funciones **ya corren desde Express** (no dependen de Electron). No se necesitan cambios.

### 5.2 Endpoint de status de Solaar

Si no existe, agregar un endpoint en el servidor:

```typescript
// server/routes/config.ts (o un nuevo routes/system.ts)
router.get('/api/solaar/status', async (_req, res) => {
  const status = await detectSolaar();
  res.json({
    installed: status.installed,
    installType: status.installType,
    running: status.running,
    version: status.version,
  });
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

### 5.3 Banner de Solaar en el frontend

Componente `SolaarStatusBanner` que consume `/api/solaar/status`:

| Situación | UI |
|---|---|
| Solaar no instalado | Banner rojo: "Solaar no detectado. ¿Está instalado?" |
| Solaar instalado pero no corriendo | Banner amarillo: "Solaar no está activo" + botón "Iniciar" |
| Solaar corriendo | No mostrar banner (estado normal) |

Este componente funciona **igual en browser y en el binario SEA** porque usa HTTP puro.

---

## Fase 6 — Autostart

### 6.1 `.desktop` file para autostart

La API de preferencias ya existe. Agregar un endpoint:

```typescript
// server/routes/preferences.ts
router.post('/api/preferences/autostart', (req, res) => {
  const { enabled } = req.body;
  const autostartDir = resolve(homedir(), '.config/autostart');
  const autostartFile = resolve(autostartDir, 'logitux.desktop');

  if (enabled) {
    mkdirSync(autostartDir, { recursive: true });
    writeFileSync(autostartFile, `[Desktop Entry]
Type=Application
Name=LogiTux
Comment=Logitech device configuration for Linux
Exec=/usr/bin/logitux --no-browser
Terminal=false
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
`);
  } else {
    if (existsSync(autostartFile)) unlinkSync(autostartFile);
  }

  setPreference('autostart', enabled ? 'true' : 'false');
  res.json({ ok: true, enabled });
});

router.get('/api/preferences/autostart', (_req, res) => {
  const autostartFile = resolve(homedir(), '.config/autostart/logitux.desktop');
  res.json({ enabled: existsSync(autostartFile) });
});
```

**Nota sobre autostart**: Cuando se inicia automáticamente al login, usa `--no-browser` para no abrir el navegador. El servidor queda corriendo en background y el usuario puede abrir `http://localhost:3001` manualmente cuando lo necesite.

### 6.2 UI de autostart

Toggle en la sección de preferencias del frontend que llama a `POST /api/preferences/autostart`.

---

## Fase 7 — Apertura automática del navegador

### 7.1 Flujo al ejecutar `./logitux`

```
1. main() arranca
2. Assets se extraen a /tmp (si SEA)
3. Express inicia en puerto 3001
4. Espera a que el servidor esté listo (poll HTTP)
5. Ejecuta `xdg-open http://localhost:3001`
6. Muestra logs en terminal
7. Ctrl+C termina el proceso
```

### 7.2 Implementación en `sea/entry.ts`

```typescript
async function waitForServer(port: string, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`http://localhost:${port}/api/solaar/status`);
      if (resp.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Server did not start in time');
}
```

### 7.3 Flag `--no-browser`

Para autostart y usuarios que prefieren abrir el browser manualmente:

```typescript
if (!process.argv.includes('--no-browser')) {
  openBrowser(`http://localhost:${PORT}`);
}
```

---

## Fase 8 — Distribución Linux

### 8.1 Estructura de instalación

Todos los paquetes (deb, rpm, AppImage) instalan la misma estructura:

```
/usr/bin/logitux                         → Enlace simbólico a /usr/lib/logitux/logitux
/usr/lib/logitux/
├── logitux                              → Binario SEA
├── native/
│   └── better_sqlite3.node              → Módulo nativo de SQLite
├── schema.sql                           → Schema de la base de datos
└── scripts/                             → Scripts default (brightness, volume, etc.)
/usr/share/applications/logitux.desktop  → Launcher de escritorio
/usr/share/icons/hicolor/256x256/apps/logitux.png  → Ícono
```

### 8.2 `packaging/logitux.desktop`

```ini
[Desktop Entry]
Name=LogiTux
Comment=Logitech device configuration for Linux
GenericName=Device Configuration
Exec=/usr/bin/logitux
Icon=logitux
Type=Application
Terminal=true
Categories=Settings;HardwareSettings;Utility;
Keywords=logitech;mouse;solaar;input;configuration;
StartupNotify=false
```

**`Terminal=true`** hace que:
- Al abrir desde el menú de aplicaciones → abre una terminal visible
- El usuario ve los logs del servidor
- Puede cerrar con Ctrl+C
- Facilita debugging

### 8.3 Paquete `.deb`

Usar `dpkg-deb` directamente (sin fpm):

```
packaging/deb/
├── DEBIAN/
│   ├── control
│   ├── postinst          # chmod, crear dirs
│   └── prerm             # cleanup
└── usr/
    ├── bin/logitux → /usr/lib/logitux/logitux
    ├── lib/logitux/
    │   ├── logitux
    │   ├── native/better_sqlite3.node
    │   └── schema.sql
    └── share/
        ├── applications/logitux.desktop
        └── icons/hicolor/256x256/apps/logitux.png
```

**`packaging/deb/control`**:
```
Package: logitux
Version: 1.0.0
Section: utils
Priority: optional
Architecture: amd64
Depends: solaar, xdotool, xprop, xdg-utils
Recommends: libnotify-bin
Maintainer: LogiTux Contributors
Description: Logitech device configuration for Linux
 A local web application for configuring Logitech mice on Linux
 using Solaar as the underlying driver. Provides a graphical
 interface for button remapping, DPI configuration, and
 per-application profiles.
Homepage: https://github.com/logitux/logitux-web
```

**Build script**:
```bash
# packaging/build-deb.sh
#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-1.0.0}"
ARCH="amd64"
PKG_DIR="$(mktemp -d)"

# Crear estructura
mkdir -p "$PKG_DIR"/{DEBIAN,usr/bin,usr/lib/logitux/native,usr/share/applications,usr/share/icons/hicolor/256x256/apps}

# Copiar binarios
cp dist-sea/logitux "$PKG_DIR/usr/lib/logitux/logitux"
chmod 755 "$PKG_DIR/usr/lib/logitux/logitux"
ln -sf /usr/lib/logitux/logitux "$PKG_DIR/usr/bin/logitux"

# Copiar nativo
cp node_modules/better-sqlite3/build/Release/better_sqlite3.node \
   "$PKG_DIR/usr/lib/logitux/native/"

# Copiar schema
cp server/db/schema.sql "$PKG_DIR/usr/lib/logitux/"

# Desktop + ícono
cp packaging/logitux.desktop "$PKG_DIR/usr/share/applications/"
cp assets/logitux.png "$PKG_DIR/usr/share/icons/hicolor/256x256/apps/"

# Control file
cat > "$PKG_DIR/DEBIAN/control" <<EOF
Package: logitux
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Depends: solaar, xdotool, xprop, xdg-utils
Maintainer: LogiTux Contributors
Description: Logitech device configuration for Linux
EOF

# Build
dpkg-deb --build "$PKG_DIR" "dist-sea/logitux_${VERSION}_${ARCH}.deb"
rm -rf "$PKG_DIR"
echo "✓ Built: dist-sea/logitux_${VERSION}_${ARCH}.deb"
```

### 8.4 Paquete `.rpm`

**`packaging/rpm/logitux.spec`**:
```spec
Name:           logitux
Version:        1.0.0
Release:        1%{?dist}
Summary:        Logitech device configuration for Linux

License:        MIT
URL:            https://github.com/logitux/logitux-web

Requires:       solaar, xdotool, xprop, xdg-utils

%description
A local web application for configuring Logitech mice on Linux
using Solaar as the underlying driver.

%install
mkdir -p %{buildroot}/usr/lib/logitux/native
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/usr/share/icons/hicolor/256x256/apps

cp %{_sourcedir}/logitux %{buildroot}/usr/lib/logitux/logitux
chmod 755 %{buildroot}/usr/lib/logitux/logitux
ln -sf /usr/lib/logitux/logitux %{buildroot}/usr/bin/logitux

cp %{_sourcedir}/better_sqlite3.node %{buildroot}/usr/lib/logitux/native/
cp %{_sourcedir}/schema.sql %{buildroot}/usr/lib/logitux/
cp %{_sourcedir}/logitux.desktop %{buildroot}/usr/share/applications/
cp %{_sourcedir}/logitux.png %{buildroot}/usr/share/icons/hicolor/256x256/apps/

%files
/usr/bin/logitux
/usr/lib/logitux/
/usr/share/applications/logitux.desktop
/usr/share/icons/hicolor/256x256/apps/logitux.png

%post
update-desktop-database /usr/share/applications/ 2>/dev/null || true
gtk-update-icon-cache /usr/share/icons/hicolor/ 2>/dev/null || true
```

### 8.5 AppImage

```bash
# packaging/build-appimage.sh
#!/usr/bin/env bash
set -euo pipefail

APPDIR="$(mktemp -d)/LogiTux.AppDir"

mkdir -p "$APPDIR"/{usr/bin,usr/lib/logitux/native,usr/share/applications,usr/share/icons/hicolor/256x256/apps}

# AppRun entry point
cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/bash
SELF="$(dirname "$(readlink -f "$0")")"
exec "$SELF/usr/lib/logitux/logitux" "$@"
EOF
chmod 755 "$APPDIR/AppRun"

# Copiar archivos
cp dist-sea/logitux "$APPDIR/usr/lib/logitux/logitux"
chmod 755 "$APPDIR/usr/lib/logitux/logitux"
cp node_modules/better-sqlite3/build/Release/better_sqlite3.node \
   "$APPDIR/usr/lib/logitux/native/"
cp server/db/schema.sql "$APPDIR/usr/lib/logitux/"
cp packaging/logitux.desktop "$APPDIR/"
cp assets/logitux.png "$APPDIR/logitux.png"
cp assets/logitux.png "$APPDIR/usr/share/icons/hicolor/256x256/apps/"

# Generar AppImage
ARCH=x86_64 appimagetool "$APPDIR" "dist-sea/LogiTux-x86_64.AppImage"
echo "✓ Built: dist-sea/LogiTux-x86_64.AppImage"
```

---

## Fase 9 — Integración con el sistema Linux

### 9.1 Launcher de escritorio

El archivo `logitux.desktop` instalado en `/usr/share/applications/` permite:

- ✅ Aparecer en el menú de aplicaciones (GNOME, KDE, XFCE, etc.)
- ✅ Crear accesos directos en el escritorio (drag & drop o copiar)
- ✅ Abrir una terminal visible con el proceso del servidor
- ✅ Buscar "LogiTux" en el launcher del DE

### 9.2 Comportamiento al abrir desde el launcher

```
Click en "LogiTux" en menú de aplicaciones
  ↓
Terminal se abre (Terminal=true en .desktop)
  ↓
./logitux ejecuta
  ↓
"[LogiTux] Server running on http://localhost:3001"
"[LogiTux] Opening browser..."
  ↓
Navegador se abre en http://localhost:3001
  ↓
Terminal muestra logs del servidor
  ↓
Ctrl+C en terminal → cierra todo limpiamente
```

### 9.3 Manejo de señales

En `sea/entry.ts`:

```typescript
// Graceful shutdown
function handleShutdown(signal: string) {
  console.log(`\n[LogiTux] Received ${signal}, shutting down...`);
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
```

---

## Fase 10 — Mantenimiento de compatibilidad

### 10.1 Modo desarrollo (sin cambios)

```bash
# Frontend + Backend con hot reload
npm run dev

# Solo backend
npm run dev:server

# Solo frontend
npm run dev:client

# Modo mock (sin Solaar)
npm run dev:cloud
```

Estos comandos **no cambian** y siguen funcionando exactamente igual.

### 10.2 Modo producción web (sin SEA)

```bash
npm run build          # Build React
npm run build:server   # Compilar servidor TS → JS
node dist-server/index.js  # Ejecutar como webapp normal
```

Para usuarios que prefieren no usar el binario standalone.

### 10.3 Modo standalone (SEA)

```bash
npm run build:sea     # Genera dist-sea/logitux
./dist-sea/logitux    # Ejecuta como app de escritorio
```

---

## Orden de implementación

| Prioridad | Fase | Descripción | Dependencia |
|-----------|------|-------------|-------------|
| 1 | Fase 1 | tsconfig.server.json + compilación TS del servidor | Ninguna |
| 2 | Fase 2 | Directorio de datos persistentes (~/.local/share/logitux/) | Fase 1 |
| 3 | Fase 3 | Entry point SEA + extractor de assets + browser opener | Fase 1, 2 |
| 4 | Fase 4 | Build script completo del binario SEA | Fase 3 |
| 5 | Fase 5 | Endpoints de Solaar (si faltan) + banner frontend | Independiente |
| 6 | Fase 6 | Autostart vía .desktop file | Fase 4 |
| 7 | Fase 7 | Apertura automática de navegador | Fase 3 |
| 8 | Fase 8 | Packaging .deb / .rpm / AppImage | Fase 4 |
| 9 | Fase 9 | Integración desktop (.desktop, íconos) | Fase 8 |
| 10 | Fase 10 | Verificación de compatibilidad dev/web | Todas |

---

## Scripts finales en `package.json`

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "LOGITUX_DEV=true tsx watch server/index.ts",
    "dev:client": "vite",
    "dev:cloud": "concurrently \"MOCK_MODE=true LOGITUX_DEV=true tsx watch server/index.ts\" \"vite\"",
    "build": "vite build",
    "build:server": "tsc -p tsconfig.server.json && cp server/db/schema.sql dist-server/db/schema.sql",
    "build:sea": "bash sea/build.sh",
    "build:all": "npm run build && npm run build:server && npm run build:sea",
    "build:deb": "bash packaging/build-deb.sh",
    "build:rpm": "bash packaging/build-rpm.sh",
    "build:appimage": "bash packaging/build-appimage.sh",
    "build:packages": "bash packaging/build-packages.sh",
    "start": "node dist-server/index.js",
    "test": "jest --verbose",
    "test:coverage": "jest --coverage --verbose"
  }
}
```

---

## Resumen de archivos nuevos a crear

| Archivo | Propósito |
|---------|-----------|
| `tsconfig.server.json` | Compilación TS del servidor |
| `sea/entry.ts` | Entry point del ejecutable standalone |
| `sea/asset-extractor.ts` | Extrae frontend del blob SEA a /tmp |
| `sea/browser-opener.ts` | Abre xdg-open con la URL |
| `sea/sea-config.json` | Configuración de Node SEA |
| `sea/build.sh` | Script de build del binario SEA |
| `packaging/logitux.desktop` | Launcher de escritorio |
| `packaging/build-deb.sh` | Generación de .deb |
| `packaging/build-rpm.sh` | Generación de .rpm |
| `packaging/build-appimage.sh` | Generación de AppImage |
| `packaging/build-packages.sh` | Script maestro (all formats) |
| `packaging/deb/control` | Metadata del paquete Debian |
| `packaging/rpm/logitux.spec` | Spec file para RPM |

## Resumen de archivos existentes a modificar

| Archivo | Cambio |
|---------|--------|
| `server/db/index.ts` | Resolución de DATA_DIR + soporte nativeBinding |
| `server/index.ts` | `LOGITUX_DIST_PATH` env var para ruta de archivos estáticos |
| `package.json` | Nuevos scripts de build/packaging |
