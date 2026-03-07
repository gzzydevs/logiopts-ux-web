# Implementation Plan: SPEC-11 Cloud Mock Mode

## Objetivo

Permitir que los agentes cloud de GitHub Copilot ejecuten la UI completa con `npm run dev:cloud` sin hardware físico ni Solaar instalado, obteniendo la app en estado `connected` con un MX Master 3 simulado.

---

## Cambios Realizados

### 1. `server/mock/data.ts` (nuevo)

Contiene las constantes de datos mock exportadas:
- `MOCK_DEVICE` — KnownDevice completo para MX Master 3
- `MOCK_PROFILES` — 3 perfiles: Default (DPI 1000), Gaming (DPI 3200), Media (DPI 800)
- `MOCK_SCRIPTS` — 3 scripts: volume.sh, brightness.sh, nightshift.sh
- `MOCK_SYSTEM_ACTIONS` — re-exporta SYSTEM_ACTIONS desde deviceDatabase.ts

Los perfiles tienen botones configurados con acciones útiles para demostración:
- Default: Middle Click → Ctrl+C
- Gaming: Forward → Ctrl+Z, window classes: steam
- Media: Smart Shift en modo gesture con controles de volumen/media

### 2. `server/mock/routes.ts` (nuevo)

Express Router que implementa todos los endpoints de la API con estado in-memory:

```
State (módulo-level, se clona del seed al importar):
  mockDevice: KnownDevice         ← clon de MOCK_DEVICE
  mockProfiles: Profile[]         ← clon de MOCK_PROFILES
  mockScripts: Script[]           ← clon de MOCK_SCRIPTS
  mockWatcherActive: boolean      ← false por defecto
```

**Endpoints implementados:**

| Método | Path                   | Comportamiento                         |
|--------|----------------------|----------------------------------------|
| GET    | /bootstrap           | Devuelve device + profiles + configs + scripts |
| GET    | /device/status       | `{ installed: true, installType: 'mock' }` |
| GET    | /device              | MX Master 3 completo                   |
| GET    | /device/system-actions | SYSTEM_ACTIONS reales                |
| PUT    | /device/:id/layout   | Actualiza layoutX/Y en mockDevice      |
| GET    | /config              | YAML vacío con comentario              |
| POST   | /config              | no-op, devuelve OK                     |
| PUT    | /config              | Actualiza buttons en perfil in-memory  |
| POST   | /config/reset        | no-op, devuelve OK                     |
| GET    | /profiles            | Lista mockProfiles                     |
| GET    | /profiles/:id        | Busca en mockProfiles                  |
| POST   | /profiles            | Push a mockProfiles                    |
| PUT    | /profiles/:id        | Actualiza en mockProfiles              |
| DELETE | /profiles/:id        | Splice de mockProfiles                 |
| GET    | /scripts             | Lista mockScripts                      |
| GET    | /scripts/:id         | Busca en mockScripts                   |
| POST   | /scripts             | Push a mockScripts                     |
| PUT    | /scripts/:id         | Actualiza en mockScripts               |
| DELETE | /scripts/:id         | Splice de mockScripts                  |
| POST   | /actions/:script     | Devuelve output simulado               |
| GET    | /watcher/status      | Devuelve `{ active: mockWatcherActive }`|
| POST   | /watcher/toggle      | Actualiza mockWatcherActive            |

### 3. `server/index.ts` (modificado)

**Cambios:**
1. Nueva import: `import mockRouter from './mock/routes.js'`
2. Nueva constante (módulo-level): `const MOCK_MODE = process.env.MOCK_MODE === 'true'`
3. Variable `currentAppliedProfileId` movida a módulo-level (antes era dentro del bloque)
4. Montaje de rutas condicionado:
   ```typescript
   if (MOCK_MODE) {
     app.use('/api', mockRouter);
   } else {
     // real routes...
   }
   ```
5. Endpoints inline (`/api/bootstrap`, `/api/watcher/*`) y event handlers
   (`windowWatcher.on`, `keyListener.start`) envueltos en `if (!MOCK_MODE)`
6. En `app.listen()`: log especial + early return cuando `MOCK_MODE=true` (sin diagnósticos)

### 4. `package.json` (modificado)

```json
"dev:cloud": "concurrently \"npm run dev:cloud:server\" \"npm run dev:client\"",
"dev:cloud:server": "MOCK_MODE=true tsx watch server/index.ts"
```

---

## Flujo de arranque con `npm run dev:cloud`

```
1. concurrently arranca dos procesos:
   a. MOCK_MODE=true tsx watch server/index.ts  (puerto 3001)
   b. vite                                       (puerto 5173)

2. El servidor Express:
   - Importa ./mock/routes.ts (crea state in-memory con seed data)
   - Monta app.use('/api', mockRouter)
   - NO monta routes reales, NO inicia windowWatcher, NO inicia keyListener
   - Sirve archivos estáticos de dist/ (si existen)
   - Escucha en puerto 3001

3. Vite dev server:
   - Sirve React app en puerto 5173
   - Proxy /api → localhost:3001

4. El navegador (o Playwright) abre http://localhost:5173:
   - React monta AppProvider
   - AppContext llama bootstrap()
   - fetchBootstrap() → GET /api/bootstrap → { device, profiles, scripts }
   - setDevice(mockDevice), setProfiles(mockProfiles)
   - appStatus = 'connected' ← UI completamente funcional
```

---

## Uso para Agentes Playwright

### Arrancar el entorno

```bash
# Instalar dependencias (si es necesario)
npm install

# Arrancar en modo cloud (sin Solaar/hardware)
npm run dev:cloud
```

### Esperar a que el servidor esté listo

```typescript
// playwright.config.ts o en el test
await page.goto('http://localhost:5173');
await page.waitForSelector('[data-testid="mouse-preview"]', { timeout: 10000 });
```

### Tomar screenshots para el PR

```typescript
// Ejemplo de test con screenshot
test('main UI connected state', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/connected-state.png', fullPage: true });
});
```

---

## Verificación

### TypeScript
```bash
npx tsc --noEmit
```

### Tests unitarios (deben pasar sin cambios)
```bash
npm test
```

### Prueba manual del mock server
```bash
MOCK_MODE=true tsx server/index.ts &
curl http://localhost:3001/api/bootstrap | jq '.data.devices[0].displayName'
# → "MX Master 3 (Mock)"
curl http://localhost:3001/api/bootstrap | jq '.data.profiles | length'
# → 3
```
