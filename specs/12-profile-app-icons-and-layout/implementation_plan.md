# SPEC-12 — Implementation Plan

> **Recordatorio**: usar `npm run dev:cloud` para levantar el servidor en modo mock (sin hardware real). Luego navegar a `http://localhost:5173` para ver la UI o usar Playwright para tests automatizados.

---

## Fase 1 — Tipos y contrato de datos

### 1.1 Actualizar `Profile` en los tipos compartidos

**Archivos**: `server/types.ts` y `src/types.ts`

Agregar los dos campos nuevos a `Profile`:

```typescript
export interface Profile {
  // ...campos existentes sin cambios
  appIcon?: string;  // URL, data:URL, o nombre de icono (/api/app-icon/:name)
  buttonLayout?: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>;
  createdAt: string;
  updatedAt: string;
}
```

Ambos son opcionales para retrocompatibilidad total con perfiles existentes.

---

## Fase 2 — Backend

### 2.1 Migración de DB

**Archivo**: `server/db/index.ts`

Al inicializar la DB, ejecutar las migraciones de forma idempotente (envolver en try/catch porque SQLite no soporta `ALTER TABLE ... IF NOT EXISTS`):

```typescript
// Migración SPEC-12: columnas appIcon y buttonLayout en profiles
for (const sql of [
  `ALTER TABLE profiles ADD COLUMN appIcon TEXT`,
  `ALTER TABLE profiles ADD COLUMN buttonLayout TEXT NOT NULL DEFAULT '{}'`,
]) {
  try { db.exec(sql); } catch { /* columna ya existe — ignorar */ }
}
```

**Archivo**: `server/db/schema.sql`

Actualizar el comentario de la tabla `profiles` para documentar las nuevas columnas:

```sql
CREATE TABLE IF NOT EXISTS profiles (
    id            TEXT PRIMARY KEY,
    deviceId      TEXT NOT NULL REFERENCES devices(id),
    name          TEXT NOT NULL,
    appName       TEXT,
    isDefault     INTEGER NOT NULL DEFAULT 0,
    dpi           INTEGER,
    buttons       TEXT NOT NULL DEFAULT '[]',
    windowClasses TEXT NOT NULL DEFAULT '[]',
    appIcon       TEXT,                         -- ← SPEC-12: URL o data:URL del icono
    buttonLayout  TEXT NOT NULL DEFAULT '{}',   -- ← SPEC-12: Record<cid, {x,y,labelSide?}>
    createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 Actualizar `profile.repo.ts`

**Archivo**: `server/db/repositories/profile.repo.ts`

1. Actualizar `ProfileRow` con los dos campos nuevos
2. Actualizar `rowToProfile()` para parsearlos
3. Actualizar los statements `insert` y `update` para incluirlos
4. Actualizar `createProfile()` y `updateProfile()` para pasar los nuevos valores

Valores por defecto al insertar: `appIcon: null`, `buttonLayout: '{}'`.

### 2.3 Nuevo endpoint `PUT /api/profiles/:id/layout`

**Archivo**: `server/routes/profiles.ts`

```
PUT /api/profiles/:id/layout
Content-Type: application/json
Body: { "layout": { "<cid>": { "x": 42.5, "y": 60.0, "labelSide": "right" }, ... } }

Response 200: { ok: true, data: <Profile actualizado> }
Response 404: { ok: false, error: "Profile not found" }
```

Implementación: leer el perfil, actualizar solo `buttonLayout`, guardar con `updateProfile()`.

### 2.4 Nuevo servicio `appScanner.ts`

**Archivo**: `server/services/appScanner.ts`

```typescript
export interface InstalledApp {
  name: string;       // Display Name del desktop file
  execName: string;   // basename del Exec= sin args
  windowClass: string; // StartupWMClass, o execName si no está definido
  iconName: string;   // Valor del campo Icon=
}

/**
 * Escanea los archivos .desktop del sistema y retorna la lista de apps instaladas.
 * Parsea /usr/share/applications/*.desktop y ~/.local/share/applications/*.desktop
 */
export async function scanInstalledApps(): Promise<InstalledApp[]>
```

Lógica:
1. `glob` ambos directorios de `.desktop` files
2. Para cada archivo: leer como texto, parsear la sección `[Desktop Entry]`
3. Extraer: `Name`, `Exec` (sacar el %u/%F/etc., tomar el basename), `Icon`, `StartupWMClass`
4. Filtrar: descartar `NoDisplay=true`, entradas sin `Exec` o sin `Name`
5. Deduplicar por `execName`
6. Ordenar por `name` (case-insensitive)
7. Devolver resultado

En caso de error (Linux no disponible, directorio no existe): devolver `[]` silenciosamente.

### 2.5 Nuevo archivo de rutas `server/routes/apps.ts`

```
GET /api/installed-apps
  → Llama scanInstalledApps(), devuelve InstalledApp[]

GET /api/app-icon/:iconName
  → Busca el icono en el sistema de iconos de Linux y lo sirve como image/png o image/svg+xml
  → Orden de búsqueda:
      1. /usr/share/icons/hicolor/48x48/apps/:name.png
      2. /usr/share/icons/hicolor/48x48/apps/:name.svg
      3. /usr/share/icons/hicolor/32x32/apps/:name.png
      4. /usr/share/pixmaps/:name.png
      5. /usr/share/pixmaps/:name.svg
  → 404 si no se encuentra
  → Cabecera Cache-Control: public, max-age=3600
```

**Archivo**: `server/index.ts` — registrar `appsRouter` antes del cierre del servidor.

### 2.6 Actualizar `server/mock/routes.ts`

Añadir los tres endpoints nuevos al mock router:

1. `GET /api/installed-apps` → lista hardcodeada de 8 apps comunes (Firefox, Chrome, VS Code, VLC, Spotify, Steam, GIMP, Inkscape)
2. `GET /api/app-icon/:iconName` → devolver un SVG placeholder con las iniciales del nombre, con color derivado del nombre (hash simple → HSL)
3. `PUT /api/profiles/:id/layout` → actualizar `buttonLayout` en el mockProfile correspondiente

### 2.7 Actualizar `server/mock/data.ts`

Añadir `appIcon` y `buttonLayout` a los 3 perfiles mock:

- `Default`: `appIcon: undefined`, `buttonLayout: {}` (sin posiciones custom)
- `Gaming`: `appIcon: '/api/app-icon/steam'`, `buttonLayout: { 83: { x: 25, y: 45 }, 86: { x: 25, y: 35 }, ... }` (ejemplo con algunas posiciones)
- `Media`: `appIcon: '/api/app-icon/vlc'`, `buttonLayout: { 195: { x: 50, y: 55 }, ... }`

---

## Fase 3 — Frontend: API layer

### 3.1 Actualizar `src/hooks/useApi.ts`

Añadir las dos funciones nuevas:

```typescript
export interface InstalledApp {
  name: string;
  execName: string;
  windowClass: string;
  iconName: string;
}

export function saveProfileLayout(
  profileId: string,
  layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>,
): Promise<Profile> {
  return api<Profile>(`/profiles/${profileId}/layout`, {
    method: 'PUT',
    body: JSON.stringify({ layout }),
  });
}

export function fetchInstalledApps(): Promise<InstalledApp[]> {
  return api<InstalledApp[]>('/installed-apps');
}
```

---

## Fase 4 — Frontend: AppContext

### 4.1 Exponer `activeProfile` en el contexto

**Archivo**: `src/context/AppContext.tsx`

En `AppContextType` agregar:
```typescript
activeProfile: Profile | null;
```

En el Provider, derivar con `useMemo` (o simplemente computar en el return):
```typescript
const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null;
```

### 4.2 Actualizar `selectProfile()`

Al seleccionar un perfil, si este tiene `buttonLayout`, actualizar el `device` local con esas posiciones:

```typescript
const selectProfile = useCallback((id: string) => {
  setActiveProfileId(id);
  const profile = profiles.find(p => p.id === id);
  if (profile) {
    setButtons([...profile.buttons]);
    // Aplicar el layout del perfil sobre el device para que MousePreview lo use
    if (device) {
      setDevice(applyProfileLayoutToDevice(device, profile.buttonLayout ?? {}));
    }
  } else {
    setButtons([]);
  }
  setDirty(false);
  setSelectedCid(null);
  setSaveStatus('idle');
  setApplyStatus('idle');
}, [profiles, device]);
```

Definir `applyProfileLayoutToDevice` como función pura fuera del componente (sin hooks):

```typescript
function applyProfileLayoutToDevice(
  device: KnownDevice,
  layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>,
): KnownDevice {
  return {
    ...device,
    buttons: device.buttons.map(btn => {
      const pos = layout[btn.cid];
      if (pos) {
        return { ...btn, layoutX: pos.x, layoutY: pos.y, ...(pos.labelSide ? { labelSide: pos.labelSide } : {}) };
      }
      // Si el perfil no tiene posición para este botón, limpiar el layout anterior
      // para no mostrar posiciones de otro perfil
      return { ...btn, layoutX: undefined, layoutY: undefined, labelSide: undefined };
    }),
  };
}
```

> **Importante**: limpiar los campos `layoutX/Y` del botón cuando el perfil nuevo no tiene posición para ese CID. Así no "quedan pegadas" posiciones de otro perfil. Si se quiere el device-level como fallback, agregar la lógica de merge apropiada.

### 4.3 Actualizar `createNewProfile()`

Clonar `buttonLayout` al crear desde otro perfil:

```typescript
// Al construir el objeto `profile` para enviarlo al backend:
const profile: Profile = {
  id: '',
  name,
  deviceName: device.unitId,
  buttons: baseButtons,
  windowClasses: windowClasses?.length ? windowClasses : undefined,
  appIcon: cloneFromProfileId ? source?.appIcon : undefined,
  buttonLayout: cloneFromProfileId && source?.buttonLayout
    ? JSON.parse(JSON.stringify(source.buttonLayout))
    : undefined,
  createdAt: '',
  updatedAt: '',
};
```

### 4.4 Actualizar el handler SSE de `profile-switched`

Cuando el watcher cambia de perfil, también aplicar el `buttonLayout`:

```typescript
es.addEventListener('profile-switched', (e) => {
  const { profileId } = JSON.parse(e.data);
  // ...existente
  const profile = profilesRef.current.find(p => p.id === profileId);
  if (profile) {
    setButtons([...profile.buttons]);
    // Aplicar layout del perfil
    setDevice(prev => prev ? applyProfileLayoutToDevice(prev, profile.buttonLayout ?? {}) : prev);
  }
  // ...resto existente
});
```

---

## Fase 5 — Frontend: LayoutEditor

### 5.1 Actualizar `LayoutEditor.tsx`

**Cambio 1 — Draft inicial desde perfil activo**:

```typescript
const { device, activeProfile, activeProfileId, addToast, bootstrap } = useAppContext();

const [draftLayout, setDraftLayout] = useState<Record<number, LayoutEntry>>(() => {
  // Prioridad 1: buttonLayout del perfil activo
  if (activeProfile?.buttonLayout && Object.keys(activeProfile.buttonLayout).length > 0) {
    return JSON.parse(JSON.stringify(activeProfile.buttonLayout));
  }
  // Prioridad 2: posiciones del device (retrocompatibilidad)
  if (!device) return {};
  const initial: Record<number, LayoutEntry> = {};
  for (const btn of device.buttons) {
    if (btn.layoutX !== undefined && btn.layoutY !== undefined) {
      initial[btn.cid] = { x: btn.layoutX, y: btn.layoutY, labelSide: btn.labelSide };
    }
  }
  return initial;
});
```

**Cambio 2 — Guardar en el perfil, no en el device**:

```typescript
const handleSave = useCallback(async () => {
  if (!device || !activeProfileId) return;
  setSaving(true);
  try {
    await saveProfileLayout(activeProfileId, draftLayout);
    addToast({ type: 'success', message: 'Button layout saved to profile!' });
    await bootstrap();
    onExit();
  } catch (err) {
    addToast({ type: 'error', message: `Failed to save layout: ${err instanceof Error ? err.message : 'Unknown error'}` });
  } finally {
    setSaving(false);
  }
}, [activeProfileId, draftLayout, addToast, bootstrap, onExit]);
```

**Cambio 3 — Texto descriptivo del banner**:

```tsx
<span className="layout-edit-badge">
  <PenLine size={14} /> LAYOUT EDIT MODE
</span>
<span className="layout-edit-hint">
  Editing layout for profile: <strong>{activeProfile?.name}</strong>. Drag buttons to reposition.
</span>
```

---

## Fase 6 — Frontend: ProfileIconBar

### 6.1 Crear `src/components/ProfileIconBar.tsx`

Props: none (usa `useAppContext` directamente).

Estado local:
- `showNewProfile: boolean` — controla el modal de crear perfil (movido desde Topbar)
- `newName`, `newWindowClasses`, `cloneFromId` — campos del modal
- `installedApps: InstalledApp[]` — lista cargada lazy cuando se abre el modal
- `loadingApps: boolean`
- `selectedApp: InstalledApp | null`
- `editingProfileId: string | null` — para el micro-modal de edit meta

Estructura JSX:

```tsx
<>
  <nav className="profile-icon-bar" aria-label="Profile switcher">
    <div className="profile-icon-bar-scroll">
      {profiles.map(profile => (
        <ProfileIconItem
          key={profile.id}
          profile={profile}
          isActive={profile.id === activeProfileId}
          isDisabled={isLayoutEditMode}
          onClick={() => !isLayoutEditMode && selectProfile(profile.id)}
          onEdit={() => openEditModal(profile.id)}
          onDelete={() => handleDelete(profile.id)}
        />
      ))}
    </div>
    {!isLayoutEditMode && device && (
      <button className="profile-icon-add-btn" onClick={() => openNewModal()} title="New profile">
        <Plus size={18} />
      </button>
    )}
  </nav>

  {/* Modal "New Profile" — via Portal */}
  {showNewProfile && createPortal(<NewProfileModal />, document.body)}
</>
```

El sub-componente `ProfileIconItem` muestra:
- `<img src={profile.appIcon}>` si hay icono, o `<ProfileAvatar name={profile.name}>` si no
- Texto del nombre (truncado)
- En hover del ítem activo: micro-botones de editar y borrar
- Clase CSS `.active` cuando `isActive`

`ProfileAvatar` (sub-componente inline o en el mismo archivo):
- Círculo de 32px
- Color de fondo: `hsl((charCode * 47) % 360, 50%, 40%)` (derivado del nombre)
- Texto: iniciales (primera letra, o primeras dos letras)

### 6.2 Sección de app icon en el modal "New Profile"

En el modal de crear perfil (ahora en `ProfileIconBar.tsx`), agregar una sección de selección de icono:

```tsx
<label>
  <span>App icon <small>(optional)</small></span>
  
  {/* Buscador de apps instaladas */}
  <input
    type="text"
    placeholder="Search installed apps..."
    value={appSearch}
    onChange={e => setAppSearch(e.target.value)}
    onFocus={() => !installedApps.length && loadApps()}
  />
  
  {/* Lista filtrada */}
  {filteredApps.length > 0 && (
    <div className="app-picker-list">
      {filteredApps.slice(0, 8).map(app => (
        <div
          key={app.execName}
          className={`app-picker-item ${selectedApp?.execName === app.execName ? 'selected' : ''}`}
          onClick={() => selectApp(app)}
        >
          <img src={`/api/app-icon/${app.iconName}`} width={24} height={24} onError={...} />
          <span>{app.name}</span>
        </div>
      ))}
    </div>
  )}
  
  {/* Preview del icono seleccionado */}
  {selectedApp && (
    <div className="selected-app-preview">
      <img src={`/api/app-icon/${selectedApp.iconName}`} width={32} height={32} />
      <span>{selectedApp.name}</span>
      <button onClick={() => setSelectedApp(null)}><X size={12} /></button>
    </div>
  )}
</label>
```

`selectApp(app)`:
- `setSelectedApp(app)`
- `setNewWindowClasses(app.windowClass)` — pre-rellenar la clase de ventana
- El `appIcon` guardado será `/api/app-icon/${app.iconName}`

### 6.3 Crear `src/components/ProfileIconBar.css`

```css
.profile-icon-bar {
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  background: rgba(18, 18, 20, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: sticky;
  top: 73px; /* altura del topbar */
  z-index: 99;
  gap: 4px;
}

.profile-icon-bar-scroll {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.profile-icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  min-width: 52px;
  max-width: 72px;
  transition: background 0.15s;
  border-bottom: 2px solid transparent;
  flex-shrink: 0;
}

.profile-icon-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.profile-icon-item.active {
  background: rgba(130, 170, 255, 0.08);
  border-bottom-color: #82aaff;
}

.profile-icon-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.profile-icon-img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
  transition: box-shadow 0.15s;
}

.profile-icon-item.active .profile-icon-img {
  box-shadow: 0 0 0 2px rgba(130, 170, 255, 0.4);
}

.profile-icon-item:hover:not(.active) .profile-icon-img {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.profile-icon-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  transition: box-shadow 0.15s;
}

.profile-icon-label {
  font-size: 0.62rem;
  color: var(--text-secondary, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 64px;
  text-align: center;
}

.profile-icon-item.active .profile-icon-label {
  color: #82aaff;
}

/* Micro-actions (hover reveal on active item) */
.profile-icon-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: none;
  gap: 2px;
}

.profile-icon-item:hover .profile-icon-actions {
  display: flex;
}

.profile-icon-action-btn {
  background: rgba(18, 18, 20, 0.8);
  border: none;
  color: rgba(255, 255, 255, 0.5);
  width: 16px;
  height: 16px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.15s;
}

.profile-icon-action-btn:hover {
  color: #fff;
}

.profile-icon-add-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-left: 8px;
}

.profile-icon-add-btn:hover {
  border-color: #fff;
  color: #fff;
}

/* App picker inside the modal */
.app-picker-list {
  display: flex;
  flex-direction: column;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
}

.app-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 0.88rem;
}

.app-picker-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.app-picker-item.selected {
  background: rgba(130, 170, 255, 0.12);
  color: #82aaff;
}

.selected-app-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(130, 170, 255, 0.08);
  border: 1px solid rgba(130, 170, 255, 0.2);
  border-radius: 8px;
  font-size: 0.88rem;
}
```

---

## Fase 7 — Frontend: Topbar cleanup

### 7.1 Simplificar `Topbar.tsx`

Eliminar del Topbar:
- El bloque `<div className="profiles-selector">` completo (dropdown de perfiles, botones `+` y trash)
- Las importaciones de `createNewProfile`, `deleteCurrentProfile` del contexto (si ya no se usan)
- Los estados `showNewProfile`, `newName`, `newWindowClasses`, `cloneFromId`
- El handler `handleCreateProfile`
- El portal del modal "New Profile"

Mantener en Topbar:
- Brand
- Device display
- Layout button
- Save button
- Apply button
- Layout mode indicator

### 7.2 Actualizar `Topbar.css`

Los estilos de `.profiles-selector`, `.add-profile-btn`, `.profile-delete-btn` y el modal ya no se usan desde Topbar. Se pueden dejar (por si hay referencias desde otras clases) o mover a `ProfileIconBar.css`. Documentar el cambio con un comentario.

---

## Fase 8 — App.tsx

### 8.1 Montar `ProfileIconBar`

```tsx
import { ProfileIconBar } from './components/ProfileIconBar';

export default function App() {
  // ...
  return (
    <div className="app">
      <Topbar />
      <ProfileIconBar />   {/* ← NUEVO */}
      <div className="app-body">
        ...
      </div>
      <ToastContainer />
    </div>
  );
}
```

`ProfileIconBar` no renderiza nada si `profiles.length === 0` (o si el app está en estado `loading`/`error`).

---

## Fase 9 — Tests

### 9.1 Unit tests para `appScanner.ts`

**Archivo**: `server/services/__tests__/appScanner.test.ts`

```typescript
// Mock fs.readdir y fs.readFile para simular archivos .desktop
// Test 1: parseo correcto de un desktop file completo
// Test 2: filtrado de NoDisplay=true
// Test 3: deduplicación por execName
// Test 4: manejo de directorio inexistente (devuelve [])
// Test 5: extracción de StartupWMClass vs fallback a execName
```

### 9.2 Unit tests para `profile.repo.ts`

**Archivo**: `server/db/__tests__/profile.repo.test.ts` (ya existe, extender)

```typescript
// Test: crear perfil con appIcon y buttonLayout
// Test: actualizar buttonLayout via updateProfile
// Test: rowToProfile parsea buttonLayout={} como undefined
// Test: rowToProfile parsea buttonLayout con posiciones como Record<number, LayoutEntry>
```

### 9.3 Unit test para `applyProfileLayoutToDevice`

**Archivo**: `src/context/__tests__/AppContext.utils.test.ts` (nuevo, o dentro del test file del context)

```typescript
// Test: botones con layout en el perfil → layoutX/Y actualizados
// Test: botones SIN layout en el perfil → layoutX/Y = undefined
// Test: buttonLayout vacío → todos los botones sin posición custom
```

---

## Orden de Implementación Recomendado

```
Fase 1  → tipos (bajo riesgo, sin dependencias)
Fase 2.1 → migración DB (sin dependencias)
Fase 2.2 → profile.repo.ts (depende de 2.1)
Fase 2.3 → PUT /api/profiles/:id/layout (depende de 2.2)
Fase 2.4 → appScanner.ts (independiente)
Fase 2.5 → apps.ts routes (depende de 2.4)
Fase 2.6 → mock/routes.ts (depende de tipos y endpoints)
Fase 2.7 → mock/data.ts (independiente)
Fase 3   → useApi.ts (depende de tipos)
Fase 4   → AppContext.tsx (depende de tipos y useApi)
Fase 5   → LayoutEditor.tsx (depende de AppContext)
Fase 6   → ProfileIconBar.tsx + CSS (depende de AppContext y useApi)
Fase 7   → Topbar.tsx cleanup (depende de ProfileIconBar funcionando)
Fase 8   → App.tsx (depende de ProfileIconBar)
Fase 9   → Tests (todo lo anterior)
```

---

## Verificación Final (Playwright / manual con dev:cloud)

Con `npm run dev:cloud`:

1. **ProfileIconBar visible**: la barra aparece debajo del topbar con 3 iconos (Default sin icono / avatar, Gaming con icono de Steam, Media con icono de VLC)
2. **Selección de perfil**: click en un icono → highlight activo, MousePreview muestra botones del perfil correcto
3. **Layout por perfil**: activar Layout Edit Mode → mover un botón → Save → cambiar de perfil → volver al anterior → el botón sigue en la posición guardada
4. **Clone from copia layout**: crear un nuevo perfil clonando Gaming → el nuevo perfil tiene el mismo layout de botones que Gaming
5. **App picker en modal**: click en `+` → abrir modal → campo de búsqueda de apps → seleccionar "VLC" → se pre-rellena windowClasses con "vlc" → crear → el nuevo perfil muestra el icono de VLC en la barra
6. **Topbar sin dropdown de perfiles**: el selector de perfiles ya no aparece en el topbar principal
