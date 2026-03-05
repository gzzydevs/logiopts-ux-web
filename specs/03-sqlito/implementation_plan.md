# Persistencia SQLite + Estado en Memoria

Ampliación del servidor Express para persistir dispositivos, perfiles, configuraciones y scripts en SQLite, manteniendo un cache en memoria que integra con el módulo [solaar/](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/parser.ts#160-253) parser existente.

## User Review Required

> [!IMPORTANT]
> **Dos sistemas de tipos coexisten** y hay que decidir cómo conectarlos:
> - [server/types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts) → [Profile](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts#91-101) con `ButtonConfig[]` (lo que usa la UI y routes actuales)
> - [server/solaar/schema.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/schema.ts) → [ProfileConfig](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/schema.ts#35-40) con `ButtonMapping[]` / [Macro](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/schema.ts#10-16) (lo que usa el parser JSON⇄YAML)
>
> **Propuesta:** La tabla `configs` persiste **ambos** formatos: `jsonConfig` almacena el [ProfileConfig](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/schema.ts#35-40) del parser (normalizado), y `uiConfig` almacena el `ButtonConfig[]` de la UI. Al guardar, el memory-store convierte entre ambos usando el parser. Cuando se aplica a Solaar, se usa `jsonConfig` → [jsonToSolaarYaml()](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/parser.ts#106-157) para generar el YAML.

> [!WARNING]
> **`better-sqlite3` es un módulo nativo** (C++). Si el entorno corre dentro de un Flatpak o contenedor, la compilación de `node-gyp` podría fallar. Alternativa: `sql.js` (WASM, zero-native). ¿Preferís `better-sqlite3` o `sql.js`?

> [!IMPORTANT]
> **El schema actual de [Profile](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts#91-101) en [types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts)** ya incluye `buttons: ButtonConfig[]`, `dpi`, `windowClasses`, `deviceName`, `createdAt/updatedAt`. La tabla `configs` propuesta va a complementar esto con el YAML generado. ¿Querés que el [Profile](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts#91-101) en DB replique exactamente la misma estructura, o preferís normalizar (separar botones en su propia tabla)?

---

## Proposed Changes

### Componente 1: Base de datos SQLite

#### [NEW] [schema.sql](file:///home/gzzy/Desktop/workspace/logitux-web/server/db/schema.sql)

```sql
-- Dispositivos detectados por Solaar (cache para no re-scanear)
CREATE TABLE IF NOT EXISTS devices (
    id          TEXT PRIMARY KEY,    -- unitId de Solaar
    name        TEXT NOT NULL,       -- solaarName
    displayName TEXT NOT NULL,
    model       TEXT,                -- svgId
    image       TEXT,                -- path a imagen opcional
    metadata    TEXT,                -- JSON: {pid, maxDpi, minDpi, dpiStep, battery, buttons[]}
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Perfiles por aplicación
CREATE TABLE IF NOT EXISTS profiles (
    id          TEXT PRIMARY KEY,
    deviceId    TEXT NOT NULL REFERENCES devices(id),
    name        TEXT NOT NULL,
    appName     TEXT,                -- windowClass para auto-switch
    isDefault   INTEGER NOT NULL DEFAULT 0,
    dpi         INTEGER,
    buttons     TEXT NOT NULL,       -- JSON: ButtonConfig[]
    windowClasses TEXT,              -- JSON: string[]
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configuraciones generadas (JSON + YAML)
CREATE TABLE IF NOT EXISTS configs (
    id          TEXT PRIMARY KEY,
    profileId   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    jsonConfig  TEXT NOT NULL,       -- JSON: ProfileConfig (parser format)
    yamlConfig  TEXT NOT NULL,       -- YAML generado por jsonToSolaarYaml()
    appliedAt   TEXT,                -- última vez que se aplicó a Solaar
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scripts bash
CREATE TABLE IF NOT EXISTS scripts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    path        TEXT NOT NULL,       -- path en disco del script
    content     TEXT NOT NULL,
    executable  INTEGER NOT NULL DEFAULT 1,
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

#### [NEW] [index.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/db/index.ts)

- Inicializa SQLite con `better-sqlite3` (o `sql.js`)
- Lee y ejecuta `schema.sql` en `db.exec()`
- Exporta singleton `db` para uso de repositorios
- Path configurable vía `DB_PATH` env var, default: `data/logitux.db`
- Pragma: `journal_mode=WAL`, `foreign_keys=ON`

---

#### [NEW] [device.repo.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/db/repositories/device.repo.ts)

Funciones:
- `upsertDevice(device: KnownDevice): void` — inserta o actualiza dispositivo
- `getAllDevices(): KnownDevice[]` — lista todos
- `getDeviceById(id: string): KnownDevice | null`
- `deleteDevice(id: string): void`

> Almacena `buttons`, `pid`, DPI info en columna `metadata` como JSON.

---

#### [NEW] [profile.repo.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/db/repositories/profile.repo.ts)

Funciones:
- `createProfile(profile: Profile): Profile`
- `updateProfile(id: string, changes: Partial<Profile>): Profile`
- [getAllProfiles(): Profile[]](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/profiles.ts#16-33)
- `getProfileById(id: string): Profile | null`
- `getProfilesByDevice(deviceId: string): Profile[]`
- `getDefaultProfile(deviceId: string): Profile | null`
- `deleteProfile(id: string): void`

> `buttons` y `windowClasses` se serializan como JSON TEXT.

---

#### [NEW] [config.repo.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/db/repositories/config.repo.ts)

Funciones:
- `saveConfig(profileId: string, json: ProfileConfig, yaml: string): Config`
- `getConfigByProfile(profileId: string): Config | null`
- `getLatestConfig(): Config | null`
- `markApplied(id: string): void`

> Se integra con el parser: al guardar, se llama [jsonToSolaarYaml()](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/parser.ts#106-157) para generar el YAML.

---

#### [NEW] [script.repo.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/db/repositories/script.repo.ts)

Funciones:
- `createScript(script): Script`
- `updateScript(id: string, changes): Script`
- `getAllScripts(): Script[]`
- `getScriptById(id: string): Script | null`
- `deleteScript(id: string): void`

> Sincroniza con el directorio `scripts/` en disco (la DB es la fuente de verdad, pero el archivo debe existir para [scriptRunner.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/scriptRunner.ts)).

---

### Componente 2: Estado en Memoria

#### [NEW] [memory-store.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/state/memory-store.ts)

```typescript
interface MemoryState {
    currentDevice: KnownDevice | null;
    activeProfileId: string | null;
    // Cache de la última configuración por profile
    configCache: Map<string, {
        json: ProfileConfig;  // formato del parser
        yaml: string;         // YAML generado
        dirty: boolean;       // true si no se ha persistido
    }>;
    // Snapshot para rollback
    lastApplied: {
        profileId: string;
        json: ProfileConfig;
        yaml: string;
    } | null;
}
```

API del store:
- `getState(): MemoryState`
- `setCurrentDevice(device: KnownDevice): void`
- `setActiveProfile(profileId: string): void`
- `updateConfig(profileId: string, config: ProfileConfig): void` — regenera YAML, marca dirty
- `persistConfig(profileId: string): void` — guarda en DB, limpia dirty flag
- `rollback(): { json, yaml } | null` — restaura lastApplied
- `invalidateProfile(profileId: string): void`
- `bootstrap(): BootstrapData` — carga todo desde DB para enviar a la UI

---

### Componente 3: Migración de Routes

#### [MODIFY] [profiles.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/profiles.ts)

**Antes:** Lee/escribe archivos JSON en `data/profiles/`  
**Después:** Usa `profile.repo.ts`. `getAllProfiles()` consulta SQLite.  
- POST crea profile en DB + genera config (JSON→YAML) y persiste en `configs`
- DELETE borra profile + config asociado (CASCADE)
- Se elimina toda la lógica de `fs/promises`

---

#### [MODIFY] [config.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/config.ts)

- GET `/api/config` → consulta memory-store para último config, fallback a DB
- POST `/api/config` → actualiza memory-store → persiste en DB → aplica a Solaar
- El flujo de apply:
  1. Recibe `ButtonConfig[]` de la UI
  2. Memory-store convierte a `ProfileConfig` del parser
  3. Parser genera YAML con `jsonToSolaarYaml()`
  4. Se persiste `{jsonConfig, yamlConfig}` en tabla `configs`
  5. Se guarda `lastApplied` en memory-store (para rollback)
  6. Se aplica a Solaar via `apply-solaar.sh`

---

#### [MODIFY] [scripts.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/scripts.ts)

**Antes:** Solo GET que lista archivos .sh  
**Después:** CRUD completo:
- GET `/api/scripts` — lista desde DB
- POST `/api/scripts` — crea script en DB + escribe en disco
- PUT `/api/scripts/:id` — edita contenido, reescribe en disco
- DELETE `/api/scripts/:id` — borra de DB + disco

---

#### [MODIFY] [buttons.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/buttons.ts)

- POST `/api/device` — al detectar un dispositivo, lo persiste en DB con `device.repo.upsertDevice()`
- GET `/api/device` sigue usando `solaar show` pero cachea resultado en DB

---

#### [NEW] Bootstrap endpoint en [index.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/index.ts)

```typescript
app.get('/api/bootstrap', async (_req, res) => {
    const data = memoryStore.bootstrap();
    res.json({ ok: true, data });
});
```

Respuesta:
```typescript
{
    devices: KnownDevice[],
    profiles: Profile[],
    configs: { profileId: string, yamlConfig: string, appliedAt: string | null }[],
    scripts: Script[]
}
```

---

### Componente 4: Bridge UI Types ↔ Parser Types

#### [NEW] [bridge.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/state/bridge.ts)

Funciones de conversión entre los dos sistemas de tipos:

- `buttonConfigsToProfileConfig(buttons: ButtonConfig[], deviceId: string, profileName: string): ProfileConfig`
  - Convierte `ButtonConfig[]` (UI) → `ProfileConfig` (parser)
  - Mapea `SolaarAction` → `Macro`
  - Mapea `GestureDirection` (None/Up/Down/Left/Right) → parser `GestureDirection` (click/up/down/left/right)

- `profileConfigToButtonConfigs(config: ProfileConfig): ButtonConfig[]`
  - Convierte `ProfileConfig` (parser) → `ButtonConfig[]` (UI)
  - Inversa de la anterior

> Este bridge es clave para que **lo que la UI manda se pueda parsear a YAML correctamente** usando el parser existente.

---

### Componente 5: Tipos Nuevos

#### [MODIFY] [types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts)

Agregar:
```typescript
export interface Script {
    id: string;
    name: string;
    path: string;
    content: string;
    executable: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BootstrapData {
    devices: KnownDevice[];
    profiles: Profile[];
    configs: { profileId: string; yamlConfig: string; appliedAt: string | null }[];
    scripts: Script[];
}
```

---

## Verification Plan

### Automated Tests

**Existentes (no se deben romper):**
```bash
npx jest --verbose
```
Los tests en `server/solaar/__tests__/` (roundtrip, json-to-yaml, yaml-to-json) deben seguir pasando al 100%. No se modifica el módulo `solaar/`.

**Nuevos tests para repositorios:**

Se creará `server/db/__tests__/` con:

1. **`repos.test.ts`** — Tests de los 4 repositorios contra una DB in-memory (`:memory:`)
   - CRUD completo de devices, profiles, configs, scripts
   - Verificar cascades (borrar profile → borra config)
   - Verificar que `jsonConfig` se serializa/deserializa correctamente

2. **`memory-store.test.ts`** — Tests del memory-store
   - `updateConfig` genera YAML correcto via parser
   - `rollback` restaura estado anterior
   - `bootstrap` devuelve datos completos

3. **`bridge.test.ts`** — Tests del bridge UI↔Parser
   - `buttonConfigsToProfileConfig` convierte correctamente
   - `profileConfigToButtonConfigs` es la inversa
   - Roundtrip: UI types → parser types → YAML → parser types → UI types

Comando:
```bash
npx jest --verbose --testPathPattern='server/db'
```

Se deberá actualizar `jest.config.ts` para incluir `server/db` y `server/state` en `roots`.

### Manual Verification

1. **Iniciar el servidor** con `npm run dev:server` y verificar que la DB se crea en `data/logitux.db`
2. **Llamar `GET /api/bootstrap`** con curl y verificar la respuesta JSON
3. **Crear un profile** via POST → verificar que aparece en la DB (usar `sqlite3 data/logitux.db "SELECT * FROM profiles"`)
4. **Aplicar config** → verificar que `configs` tiene el YAML generado y que el YAML coincide con lo que produce `jsonToSolaarYaml()`

> [!NOTE]
> La verificación manual de la integración con Solaar (que el YAML se aplique correctamente) requiere tener Solaar instalado y un dispositivo Logitech conectado. Se puede verificar parcialmente comparando el YAML generado con el formato esperado.
