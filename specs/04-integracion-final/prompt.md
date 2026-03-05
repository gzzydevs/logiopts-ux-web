# 🚀 Prompt — Integración Final: Frontend ↔ Backend ↔ Solaar

## Contexto del proyecto

LogiTux es una app web (Vite + React + Express) para configurar macros de mouse Logitech en Linux via Solaar. Corre en Bazzite (Fedora immutable con Flatpak).

### Lo que YA está implementado y funciona:

**Backend (Express + SQLite):**
- `server/db/schema.sql` — 4 tablas: `devices`, `profiles`, `configs`, `scripts`
- `server/db/index.ts` — singleton SQLite con WAL + FK
- `server/db/repositories/` — 4 repos con CRUD completo:
  - `device.repo.ts` — upsert/getAll/getById/delete
  - `profile.repo.ts` — CRUD, buscar por device/appName/default
  - `config.repo.ts` — save genera YAML via parser automáticamente, markApplied
  - `script.repo.ts` — CRUD + sync a disco + validación de comandos peligrosos
- `server/state/bridge.ts` — convierte `ButtonConfig[]` (UI) ↔ `ProfileConfig` (parser)
- `server/state/memory-store.ts` — cache in-memory con rollback, bootstrap desde DB
- `server/solaar/` — parser JSON↔YAML determinístico con validator (93% coverage)
- `server/services/profileApplier.ts` — aplica perfil a Solaar via shell script
- `server/services/configGenerator.ts` — genera config.yaml y rules.yaml
- `server/services/scriptRunner.ts` — ejecuta scripts via `flatpak-spawn --host`
- `server/services/solaarDetector.ts` — detecta Solaar (flatpak/system), parsea `solaar show`
- `scripts/apply-solaar.sh` — escribe config, reinicia Solaar
- Rutas migradas a DB: `profiles.ts`, `config.ts`, `scripts.ts`, `buttons.ts`
- `GET /api/bootstrap` — devuelve `{devices, profiles, configs, scripts}` para carga inicial

**Tests (37 DB + 16 bridge + anteriores del parser = 148 total, todos pasan):**
- `server/db/__tests__/repos.test.ts` — schema, CRUD raw SQL, FK constraints, cascades
- `server/db/__tests__/device.repo.test.ts` — device repo functions
- `server/db/__tests__/profile.repo.test.ts` — profile repo functions
- `server/db/__tests__/config.repo.test.ts` — config repo + integración con parser
- `server/db/__tests__/script.repo.test.ts` — script repo + validación dangerous commands
- `server/state/__tests__/bridge.test.ts` — conversión UI↔parser bidireccional
- `server/solaar/__tests__/` — roundtrip, json-to-yaml, yaml-to-json

**Frontend (React + TypeScript):**
- `src/types.ts` — tipos correctos que matchean el server (`KnownDevice`, `ButtonConfig`, `SolaarAction`, `Profile`)
- `src/hooks/useApi.ts` — todas las llamadas API ya armadas (`fetchDevice`, `applyConfig`, `fetchProfiles`, etc.)
- `src/components/` — 13 componentes: Topbar, SettingsPanel, MousePreview, ActionConfigurator, ActionPicker, KeyCapture, ButtonConfig, MouseView, ProfileManager
- `src/context/AppContext.tsx` — estado global con React Context

---

## 🔴 EL PROBLEMA PRINCIPAL

El frontend está **100% desconectado** del backend. Específicamente:

### 1. AppContext usa tipos propios INCOMPATIBLES con el server

```typescript
// AppContext.tsx — TIPOS INCORRECTOS que usa actualmente:
interface Device { id: string; name: string; imageUrl: string }  // ← NO es KnownDevice
interface MacroSlot { type: 'system' | 'bash' | 'keyboard' | null; value: string }  // ← NO es SolaarAction
interface ButtonConfig { buttonId: string; click: MacroSlot; up: MacroSlot; ... }  // ← NO matchea server
interface Profile { id: string; name: string; icon: string; buttonConfigs: Record<string, ButtonConfig> }
```

Los tipos CORRECTOS ya existen en `src/types.ts`:
```typescript
// src/types.ts — los que DEBERÍAN usar:
interface KnownDevice { displayName, solaarName, unitId, pid, buttons: KnownButton[], maxDpi, ... }
type SolaarAction = { type: 'KeyPress'; keys: string[] } | { type: 'MouseClick'; ... } | { type: 'Execute'; ... } | ...
interface ButtonConfig { cid: number; gestureMode: boolean; gestures: Record<GestureDirection, SolaarAction>; simpleAction: SolaarAction }
interface Profile { id, name, deviceName, dpi?, buttons: ButtonConfig[], windowClasses?, createdAt, updatedAt }
```

### 2. Ningún componente llama al backend

- `useApi.ts` tiene `fetchDevice()`, `applyConfig()`, `fetchProfiles()` etc. pero NADIE las llama
- AppContext tiene datos mock hardcodeados: `mockDevices`, `mockProfiles`
- No hay botón "Guardar" ni "Aplicar" en la UI

### 3. ActionConfigurator usa MacroSlot en vez de SolaarAction

El `ActionConfigurator` actual tiene dropdowns con `system | bash | keyboard` que no mapean a ningún tipo del server. Necesita usar `SolaarAction` types: `KeyPress | MouseClick | MouseScroll | Execute | RunScript | None`.

---

## 🎯 Objetivo

Lograr este flujo funcional end-to-end:

```
1. App monta → GET /api/bootstrap → popular UI con datos de DB
2. Si no hay device → botón "Detectar" → GET /api/device → parsea solaar show → guarda en DB
3. MousePreview muestra botones del device real (de KnownButton[])
4. Click en botón → ActionConfigurator con SolaarAction types
5. Editar acciones → se actualiza el estado local
6. Click "Guardar" → PUT /api/config → guarda en DB sin aplicar
7. Click "Aplicar" → POST /api/config → pipeline completo:
   JSON → bridge → parser → YAML → DB → apply-solaar.sh → restart Solaar
8. Toast de éxito o error con detalle
9. Si falla Solaar → rollback automático (ya implementado en memory-store)
```

---

## 📋 Tareas específicas

### Fase 1 — Rewrite AppContext

**Archivo: `src/context/AppContext.tsx`**

Eliminar todos los tipos propios (`MacroSlot`, `Device`, etc.) y usar los de `src/types.ts`. El state debe incluir:
- `device: KnownDevice | null` — device detectado
- `profiles: Profile[]` — del DB
- `activeProfileId: string | null`
- `buttons: ButtonConfig[]` — config actual del perfil activo
- `scripts: Script[]` — para el selector de RunScript
- `saveStatus: 'idle' | 'saving' | 'saved' | 'error'`
- `applyStatus: 'idle' | 'applying' | 'applied' | 'error'`
- `toasts: Toast[]` — notificaciones

Funciones:
- `bootstrap()` — llama `GET /api/bootstrap`, popula todo
- `detectDevice()` — llama `GET /api/device`
- `updateButton(cid, changes)` — actualiza button config local
- `saveConfig()` — llama `PUT /api/config`
- `applyConfig()` — llama `POST /api/config`

### Fase 2 — Conectar componentes

**`App.tsx`** — al montar llamar `bootstrap()`, mostrar loading/error/connected

**`Topbar.tsx`** — usar `KnownDevice` del context, agregar botones Save + Apply con loading states

**`MousePreview.tsx`** — renderizar nodos dinámicamente desde `device.buttons` (KnownButton[]) en vez del array hardcoded `MOUSE_NODES`

**`ActionConfigurator.tsx`** — reescribir para usar `SolaarAction`:
- Dropdown principal: None | KeyPress | MouseClick | MouseScroll | Execute | RunScript
- KeyPress → usar componente KeyCapture existente
- RunScript → dropdown con scripts del bootstrap
- Execute → input de comando
- MouseClick → selects para button (left/middle/right) y count
- MouseScroll → inputs numéricos para horizontal/vertical

### Fase 3 — Toast component

Crear `Toast.tsx` + `Toast.css` — notificaciones con auto-dismiss, tipos success/error/warning.

### Fase 4 — Endpoint unificado de apply

Crear `server/routes/apply.ts` con `POST /api/apply-config`:
1. Recibe `{ profileId }` (toma los buttons del profile en DB)
2. Usa bridge para convertir ButtonConfig[] → ProfileConfig
3. Valida con `validateProfileConfig()`
4. Genera YAML con `jsonToSolaarYaml()`
5. Guarda en DB via `config.repo.saveConfig()`
6. Genera archivos Solaar via `configGenerator`
7. Aplica via `apply-solaar.sh`
8. Marca como applied
9. Rollback si falla

### Fase 5 — Tests

- Tests de integración para el endpoint apply
- Tests del AppContext (mock fetch)
- Verificar que `npx jest` sigue pasando todos los 148+ tests

---

## ⚠️ Cosas a tener en cuenta

1. **NO usar `.js` en imports** — el proyecto usa `tsx` y `ts-jest` con moduleNameMapper que stripea `.js`
2. **`import.meta.url`** — no funciona con ts-jest (CJS mode). Usar `process.cwd()` o `__dirname` en código que necesite ser testeado
3. **Bazzite/Flatpak** — scripts se ejecutan via `flatpak-spawn --host`. No asumir root
4. **`server/db/index.ts`** usa `import.meta.url` — funciona en runtime (tsx) pero en tests los repos se mockean con `jest.mock('../index', () => testDb)` usando DB in-memory
5. **Bridge ya existe** — `server/state/bridge.ts` convierte `ButtonConfig[]` ↔ `ProfileConfig`. No crear otro
6. **Memory store ya tiene rollback** — `snapshotForRollback()` y `rollback()` ya funcionan
7. **Los tests de repos mockean fs** — `script.repo.test.ts` mockea `node:fs` para no escribir a disco

---

## 📁 Archivos clave para referencia rápida

| Archivo | Qué hace |
|---|---|
| `src/types.ts` | Tipos frontend (mirrors server) |
| `src/hooks/useApi.ts` | Llamadas API (ya armadas, sin usar) |
| `src/context/AppContext.tsx` | Estado global (a reescribir) |
| `server/types.ts` | Tipos server (source of truth) |
| `server/state/bridge.ts` | ButtonConfig[] ↔ ProfileConfig |
| `server/state/memory-store.ts` | Cache + rollback + bootstrap |
| `server/solaar/parser.ts` | JSON → YAML determinístico |
| `server/services/profileApplier.ts` | Aplica perfil a Solaar |
| `server/routes/config.ts` | GET/POST/PUT config |
| `server/routes/profiles.ts` | CRUD profiles |
| `server/index.ts` | Express setup + bootstrap endpoint |
