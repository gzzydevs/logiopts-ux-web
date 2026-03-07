# Spec 06 — Implementation Plan

## Fase 1: Fundación de Datos (DB + Preferencias)

### 1.1 Tabla `preferences`

**Archivo**: `server/db/schema.sql`

```sql
CREATE TABLE IF NOT EXISTS preferences (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

**Keys iniciales**:
| Key | Type | Default | Descripción |
|-----|------|---------|-------------|
| `windowWatcherEnabled` | `"true"/"false"` | `"false"` | Activar window watcher al arrancar |
| `lastActiveProfileId` | `number as string` | `null` | Último perfil activo |
| `locale` | `string` | `"en"` | Idioma de la UI |

### 1.2 Repository de preferencias

**Archivo**: `server/db/repositories/preferences.repo.ts`

```typescript
export interface PreferencesRepo {
    get(key: string): string | null;
    set(key: string, value: string): void;
    getAll(): Record<string, string>;
    delete(key: string): void;
}
```

Prepared statements simples: `INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)`.

### 1.3 API routes

**Archivo**: `server/routes/preferences.ts`

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/preferences` | — | `Record<string, string>` |
| `GET` | `/api/preferences/:key` | — | `{ value: string }` o 404 |
| `PUT` | `/api/preferences/:key` | `{ value: string }` | 200 |

---

## Fase 2: Save Button Completo

### 2.1 Backend — persist buttons en profile

**Archivo**: `server/routes/config.ts` (`PUT /api/config`)

Actualmente `saveConfigToDB` solo escribe en tabla `configs`. Agregar:
```typescript
// Después de persistConfig():
profileRepo.update(profileId, { buttons: JSON.stringify(buttons) });
```

O alternativamente, que `profileApplier.persistConfig()` haga ambas cosas.

### 2.2 Frontend — feedback de guardado

**Archivo**: `src/context/AppContext.tsx`

El `saveConfig()` ya llama `PUT /api/config`. Verificar que:
1. Muestra toast de éxito
2. Resetea `dirty = false`
3. Actualiza el profile en el array local de profiles

---

## Fase 3: Perfil Activo como Concepto Formal

### 3.1 Server-side active profile

**Archivo**: `server/state/memory-store.ts`

Agregar al MemoryStore:
```typescript
interface MemoryState {
    // ...existing fields...
    activeProfileId: number | null;   // lo que el mouse tiene cargado
}
```

Actualizar `activeProfileId` en:
- `applyConfig()` — cuando se aplica un perfil
- `bootstrap()` — al arrancar, leer de `preferences.lastActiveProfileId`

### 3.2 API endpoint

**Archivo**: `server/routes/profiles.ts`

```
GET /api/active-profile → { profileId: number | null }
POST /api/active-profile → { profileId: number } → aplica y setea activo
```

### 3.3 Frontend — distinguir activo de seleccionado

**Archivo**: `src/context/AppContext.tsx`

```typescript
// Estado actual:
activeProfileId    // ← renombrar a selectedProfileId

// Agregar:
appliedProfileId   // ← lo que el mouse tiene cargado (viene del server)
```

### 3.4 UI — Badge "Active"

**Archivo**: `src/components/ProfileSelector.tsx` (o donde se listan perfiles)

```tsx
{profiles.map(p => (
    <option key={p.id} value={p.id}>
        {p.name} {p.id === appliedProfileId ? '● Active' : ''}
    </option>
))}
```

Si no existe ProfileSelector como componente dedicado, crear uno o agregar al Topbar.

---

## Fase 4: Window Watcher Mejorado

### 4.1 Persistencia del toggle

**Archivo**: `server/index.ts` (bootstrap)

Al arrancar el server:
```typescript
const watcherPref = preferencesRepo.get('windowWatcherEnabled');
if (watcherPref === 'true') {
    windowWatcher.start();
}
```

Al cambiar el toggle (`POST /api/watcher/toggle`):
```typescript
preferencesRepo.set('windowWatcherEnabled', active ? 'true' : 'false');
```

### 4.2 Fallback al perfil activo (no al default)

**Archivo**: `server/index.ts` (window-changed handler)

```typescript
// Actual:
const fallback = profiles.find(p => p.name.toLowerCase() === 'default');

// Nuevo:
const activeId = memoryStore.getState().activeProfileId;
const fallback = profiles.find(p => p.id === activeId)
    ?? profiles.find(p => p.isDefault)
    ?? profiles[0];
```

Cascada: activo → default → primero disponible.

### 4.3 Actualizar activeProfileId al aplicar por watcher

Cuando el watcher aplica un perfil temporal (por match de ventana), **NO** cambia `activeProfileId`. El activo sigue siendo el que el usuario eligió. Solo cambia `currentlyLoadedProfileId` (lo que el mouse tiene en este instante).

**Distinción fina**:
- `activeProfileId` = "el perfil base del usuario" (persiste)
- `currentlyLoadedProfileId` = "lo que el mouse tiene ahora" (puede ser un window-matched profile)

Cuando el watcher no encuentra match, vuelve a `activeProfileId`.

---

## Fase 5: Server → Frontend Push (SSE)

### 5.1 SSE Endpoint

**Archivo**: `server/routes/events.ts`

```typescript
router.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Subscribe to memory store events
    const unsub = memoryStore.on('change', (event) => {
        send(event.type, event.payload);
    });

    req.on('close', unsub);
});
```

### 5.2 Eventos

| Event | Payload | Cuándo |
|-------|---------|--------|
| `profile-switched` | `{ profileId, profileName, trigger: 'user' \| 'watcher' }` | Al aplicar un perfil |
| `config-applied` | `{ profileId, timestamp }` | Después de escribir rules.yaml |
| `watcher-status` | `{ active: boolean }` | Al cambiar toggle |

### 5.3 Frontend — EventSource

**Archivo**: `src/context/AppContext.tsx`

```typescript
useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('profile-switched', (e) => {
        const { profileId, trigger } = JSON.parse(e.data);
        setAppliedProfileId(profileId);
        if (trigger === 'watcher') {
            addToast(`Profile auto-switched`, 'info');
        }
    });

    return () => es.close();
}, []);
```

---

## Fase 6: Restaurar Estado al Bootstrap

### 6.1 Server bootstrap

**Archivo**: `server/index.ts` (`GET /api/bootstrap`)

Agregar al response:
```typescript
{
    // ...existing fields...
    preferences: preferencesRepo.getAll(),
    activeProfileId: memoryStore.getState().activeProfileId,
}
```

### 6.2 Frontend bootstrap

**Archivo**: `src/context/AppContext.tsx`

```typescript
const { preferences, activeProfileId, profiles, ... } = await apiBootstrap();

// Restaurar estado:
setAppliedProfileId(activeProfileId);
const lastSelected = preferences.lastActiveProfileId;
const initialProfile = profiles.find(p => p.id === Number(lastSelected))
    ?? profiles.find(p => p.id === activeProfileId)
    ?? profiles.find(p => p.isDefault)
    ?? profiles[0];
selectProfile(initialProfile.id);
```

---

## DB Migration Strategy

Dado que la DB es SQLite local y la app está en desarrollo, los cambios de schema se pueden aplicar directamente en `schema.sql` — `CREATE TABLE IF NOT EXISTS` es idempotente. No se necesita sistema de migrations todavía.

---

## Orden de Ejecución Sugerido

| # | Task | Estimación | Dependencias |
|---|------|-----------|--------------|
| 1 | Tabla `preferences` + repo + routes | 30 min | — |
| 2 | Fix Save button (persist buttons en profiles) | 20 min | — |
| 3 | Active profile en MemoryStore + API | 30 min | 1 |
| 4 | Frontend: `appliedProfileId` + badge | 30 min | 3 |
| 5 | Window Watcher: persistencia toggle + fallback activo | 30 min | 1, 3 |
| 6 | SSE endpoint + frontend EventSource | 45 min | 3 |
| 7 | Bootstrap: restaurar preferences + last profile | 20 min | 1, 3, 6 |

**Estimación total**: ~3.5 horas

## Archivos a Crear/Modificar

### Crear:
- `server/db/repositories/preferences.repo.ts`
- `server/routes/preferences.ts`
- `server/routes/events.ts`

### Modificar:
- `server/db/schema.sql` — agregar tabla `preferences`
- `server/db/index.ts` — registrar nueva tabla
- `server/state/memory-store.ts` — agregar `activeProfileId`, event emitter
- `server/index.ts` — bootstrap pref restore, watcher fallback, SSE wiring
- `server/routes/config.ts` — save persists profile buttons
- `server/routes/profiles.ts` — active profile endpoint
- `src/context/AppContext.tsx` — `appliedProfileId`, SSE subscription, bootstrap restore
- `src/components/Topbar.tsx` (o equivalente) — badge "Active"
- `src/components/SettingsPanel.tsx` — watcher toggle sync with preferences
