# SPEC-12: Profile App Icons, Profile Switcher Bar y Layout por Perfil

## Resumen Ejecutivo

Este spec define tres mejoras relacionadas al sistema de perfiles:

1. **Icono de app por perfil** — cada perfil puede almacenar un icono visual que lo identifique (ej: el icono de Firefox para el perfil de Firefox).
2. **ProfileIconBar** — una segunda barra horizontal debajo del topbar principal que muestra los perfiles como iconos clicables, con highlight del perfil activo. Inspirada en la interfaz de Logitech Options+.
3. **Layout de botones por perfil** — el `buttonLayout` (posiciones de botones en el canvas) pasa de estar almacenado en el dispositivo a estar almacenado en el perfil. Esto permite que cada perfil tenga su propia disposición visual, y que al clonar un perfil también se copie el layout.

---

## Motivación

### Problema 1 — Perfiles sin identidad visual
Actualmente todos los perfiles son "anónimos": se distinguen solo por nombre en un `<select>` dropdown. No hay forma de ver de un vistazo qué perfil está activo ni para qué app sirve cada uno.

### Problema 2 — Un solo layout de botones para todos los perfiles
El `buttonLayout` (coordenadas de los nodos en el `LayoutEditor`) se guarda en `devices.metadata.buttonLayout` — es decir, es un atributo del *dispositivo*, no del *perfil*. Si el usuario edita el layout para el perfil Gaming, esa posición de botones queda para todos los perfiles. No tiene sentido: dos perfiles podrían querer mostrar distintos botones en distintas posiciones para comunicar mejor qué hace cada uno.

### Problema 3 — Clone from no trae el layout
`createNewProfile(..., cloneFromProfileId)` deep-clona los `buttons` (acciones) del perfil fuente, pero no tiene nada que clonar en cuanto a layout porque ese dato está en el device, no en el profile.

---

## Arquitectura General

### Diagrama de capas

```
┌─────────────────────────────────────────────────────────┐
│                        Topbar                           │  ← existente (sin cambios mayores)
│  Brand  |  Device  |  Actions (Save/Apply/Layout)       │
├─────────────────────────────────────────────────────────┤
│                   ProfileIconBar  ← NUEVO               │
│  [🎮 Default]  [🎮 Gaming]  [🎵 Media]  [+]            │
│        ↑ active: borde inferior + fondo suave           │
├─────────────────────────────────────────────────────────┤
│                     app-body                            │
│   MousePreview  |  SettingsPanel                        │
└─────────────────────────────────────────────────────────┘
```

---

## Feature A — Icono de App por Perfil

### A.1 Modelo de datos

Agregar campo `appIcon` al tipo `Profile`:

```typescript
// server/types.ts y src/types.ts
export interface Profile {
  id: string;
  name: string;
  deviceName: string;
  dpi?: number;
  buttons: ButtonConfig[];
  windowClasses?: string[];
  appIcon?: string;  // ← NUEVO: URL, data:URL, o nombre de icono del sistema
  buttonLayout?: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>;  // ← NUEVO (ver Feature C)
  createdAt: string;
  updatedAt: string;
}
```

`appIcon` puede ser:
- Una **data URL** (`data:image/png;base64,...`) — icono subido manualmente o resuelto desde el sistema
- Una **URL relativa** al endpoint del servidor (`/api/app-icon/firefox`) — icono del sistema resuelto en runtime
- `undefined` — sin icono, se muestra un avatar de iniciales

### A.2 Selector de app instalada

El usuario puede escoger el icono desde un listado de apps instaladas en el sistema, en el modal de crear/editar perfil.

**Endpoint nuevo: `GET /api/installed-apps`**

Devuelve la lista de apps del sistema:

```typescript
interface InstalledApp {
  name: string;          // "Firefox Web Browser"
  execName: string;      // "firefox"
  windowClass: string;   // "firefox" o "Navigator" (del campo StartupWMClass en .desktop)
  iconName: string;      // "firefox" (nombre del icono en el sistema)
}

// Response shape:
{ ok: true, data: InstalledApp[] }
```

**Implementación en Linux**: parsear archivos `.desktop`:
- `/usr/share/applications/*.desktop`
- `~/.local/share/applications/*.desktop`

Campos relevantes del `.desktop`:
```ini
[Desktop Entry]
Name=Firefox Web Browser
Exec=firefox %u
Icon=firefox
StartupWMClass=Navigator
NoDisplay=false
```

Filtros: descartar entradas con `NoDisplay=true` o sin `Exec`. Deduplicar por `execName`. Ordenar por `Name`.

**Endpoint nuevo: `GET /api/app-icon/:iconName`**

Resuelve y sirve el icono de una app desde el sistema de iconos de Linux. Búsqueda en orden:

1. `/usr/share/icons/hicolor/48x48/apps/:iconName.png`
2. `/usr/share/icons/hicolor/48x48/apps/:iconName.svg`
3. `/usr/share/icons/hicolor/32x32/apps/:iconName.png`
4. `/usr/share/pixmaps/:iconName.png`
5. `/usr/share/pixmaps/:iconName.svg`
6. Responde `404` si no se encuentra

Response: `Content-Type: image/png` o `image/svg+xml` con el archivo binario.

Cuando el usuario selecciona una app:
1. `appIcon` se guarda como la URL del endpoint: `/api/app-icon/:iconName`
2. `windowClasses` se pre-rellena con `[app.windowClass]` (el campo StartupWMClass) — el usuario puede ajustar
3. Se persiste via `PUT /api/profiles/:id` con `{ appIcon, windowClasses }`

### A.3 Modal de edición: sección de App Icon

En el modal "New Profile" (y en un futuro modal "Edit Profile"), agregar una sección para escoger el icono:

```
┌─────────────────────────────────────────┐
│ App icon                                │
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Search installed apps...       │  │
│  └───────────────────────────────────┘  │
│  [firefox icon] Firefox                 │
│  [chrome icon]  Google Chrome           │
│  [code icon]    Visual Studio Code      │
│  ...                                    │
│                                         │
│  (or paste an icon URL manually)        │
└─────────────────────────────────────────┘
```

UX:
- Lista `<select>` o lista desplegable filtrable (input de búsqueda + listado scrollable)
- Cuando se selecciona una app: pre-rellena `windowClasses` con el `windowClass` detectado
- Si el backend no está en Linux / la lista está vacía: mostrar input de URL manual
- Vista previa del icono seleccionado en tiempo real

---

## Feature B — ProfileIconBar (segunda barra)

### B.1 Componente: `ProfileIconBar.tsx`

Nuevo componente montado en `App.tsx` entre `<Topbar>` y `<div className="app-body">`.

```tsx
// src/components/ProfileIconBar.tsx
// Renders a horizontal scrollable bar of profile icons.
// Active profile is highlighted. Clicking selects that profile.
```

### B.2 Layout visual

```
┌──────────────────────────────────────────────────────────────┐
│  [icono]  [icono]  [icono]  [icono]  [+]                    │
│  Default  Gaming   Media    Work                             │
│     ↑ active: borde inferior + fondo tenue                  │
└──────────────────────────────────────────────────────────────┘
```

**Dimensiones y estilos:**
- Altura: `~60px`
- Fondo: `rgba(18, 18, 20, 0.5)` + `backdrop-filter: blur(8px)`
- Borde inferior: `1px solid rgba(255,255,255,0.05)` (igual que topbar)
- `position: sticky; top: <altura-topbar>; z-index: 99` (un nivel menos que el topbar, que es z-index 100)

**Cada ítem de perfil:**
- Contenedor: `width: 56px; padding: 8px 4px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 8px;`
- Icono: `width: 32px; height: 32px; border-radius: 8px; object-fit: cover;`
- Si no hay `appIcon`: avatar circular con las iniciales del perfil (misma lógica que GitHub avatars), con color derivado del nombre (hash simple)
- Label: nombre truncado a `~8 chars`, `font-size: 0.65rem; color: var(--text-secondary);`
- Tooltip nativo (`title`) con el nombre completo

**Estado activo:**
- `border-bottom: 2px solid var(--accent, #82aaff)`
- `background: rgba(130,170,255,0.08)`
- Icono: leve `box-shadow: 0 0 0 2px rgba(130,170,255,0.4)`
- Label: `color: #82aaff`

**Estado hover (inactivo):**
- `background: rgba(255,255,255,0.05)`
- Icono: `box-shadow: 0 0 0 1px rgba(255,255,255,0.2)`

**Botón `+` al final:**
- Mismo estilo que `.add-profile-btn` existente (actualmente en Topbar)
- Abre el mismo modal "New Profile"
- Solo visible si `!isLayoutEditMode && device`

**Scroll horizontal:**
- Si hay muchos perfiles: `overflow-x: auto; overflow-y: hidden; scrollbar-width: thin;`
- Sin cortar la barra a un ancho fijo; crece con el contenido

**Edit/Delete en hover:**
- En hover sobre un ítem activo aparecen micro-iconos (`PenLine` para editar meta, `Trash2` para borrar)
- Similar al patrón hover-reveal de Notion/Figma sidebars
- Solo si `!isLayoutEditMode`

### B.3 Integración en App.tsx

```tsx
// App.tsx
import { ProfileIconBar } from './components/ProfileIconBar';

// ...
return (
  <div className="app">
    <Topbar />
    <ProfileIconBar />   {/* ← nuevo */}
    <div className="app-body">
      ...
    </div>
    <ToastContainer />
  </div>
);
```

### B.4 Cambios en Topbar.tsx

Con la `ProfileIconBar` manejando la selección y creación de perfiles, el `Topbar` se simplifica:

- **Eliminar**: el bloque `<div className="profiles-selector">` con el `<select>` dropdown, el botón `+`, y el botón trash
- **Mantener**: Brand, Device info, Layout button, Save button, Apply button
- **El modal "New Profile"** pasa a estar en `ProfileIconBar.tsx` (o en un componente compartido `ProfileModal.tsx`)
- **Nota**: el bloque `isLayoutEditMode` indicator también se mantiene en el Topbar

> **Razón**: el dropdown del topbar y la icon bar serían redundantes. Al tener la icon bar, el dropdown queda obsoleto. El selector activo de Layout Edit Mode se conserva en Topbar porque es una acción de dispositivo, no de perfiles.

---

## Feature C — Button Layout por Perfil

### C.1 Motivación técnica

**Situación actual**: `buttonLayout` está en `devices.metadata.buttonLayout` (JSON en la columna `metadata`). Es un único layout global para el dispositivo, compartido por todos los perfiles.

**Situación deseada**: cada perfil tiene su propio `buttonLayout`. Al cambiar de perfil, el `MousePreview` muestra los botones en las posiciones definidas para ese perfil. Al clonar un perfil, se copia también el layout.

### C.2 Migración del esquema de DB

```sql
-- server/db/schema.sql (agregar a la tabla profiles)
ALTER TABLE profiles ADD COLUMN buttonLayout TEXT NOT NULL DEFAULT '{}';
```

Como `CREATE TABLE IF NOT EXISTS` no afecta tablas ya existentes, se necesita una migración separada ejecutada en `server/db/index.ts` al arrancar el servidor:

```typescript
// server/db/index.ts — migración segura
db.exec(`
  ALTER TABLE profiles ADD COLUMN buttonLayout TEXT NOT NULL DEFAULT '{}';
`);
// Envolver en try/catch porque falla si la columna ya existe (SQLite no tiene IF NOT EXISTS para ALTER TABLE)
```

**La columna `buttonLayout` en `devices.metadata`** se mantiene por retrocompatibilidad como fallback, pero el valor de un perfil específico tiene precedencia.

### C.3 Tipo `Profile` actualizado

```typescript
export interface Profile {
  id: string;
  name: string;
  deviceName: string;
  dpi?: number;
  buttons: ButtonConfig[];
  windowClasses?: string[];
  appIcon?: string;
  /** Per-profile button layout positions. Overrides device-level layout for this profile. */
  buttonLayout?: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>;
  createdAt: string;
  updatedAt: string;
}
```

### C.4 Actualización de `profile.repo.ts`

```typescript
// Agregar a ProfileRow:
interface ProfileRow {
  // ...existentes
  appIcon: string | null;
  buttonLayout: string;  // JSON: Record<number, LayoutEntry>
}

// Actualizar rowToProfile():
function rowToProfile(row: ProfileRow): Profile {
  return {
    // ...existentes
    appIcon: row.appIcon ?? undefined,
    buttonLayout: Object.keys(JSON.parse(row.buttonLayout)).length > 0
      ? JSON.parse(row.buttonLayout)
      : undefined,
  };
}

// Actualizar INSERT y UPDATE para incluir appIcon y buttonLayout:
stmts.insert = db.prepare(`
  INSERT INTO profiles (id, deviceId, name, appName, isDefault, dpi, buttons, windowClasses, appIcon, buttonLayout, createdAt, updatedAt)
  VALUES (@id, @deviceId, @name, @appName, @isDefault, @dpi, @buttons, @windowClasses, @appIcon, @buttonLayout, @createdAt, @updatedAt)
`);

stmts.update = db.prepare(`
  UPDATE profiles SET
    name = @name, appName = @appName, isDefault = @isDefault, dpi = @dpi,
    buttons = @buttons, windowClasses = @windowClasses,
    appIcon = @appIcon, buttonLayout = @buttonLayout,
    updatedAt = @updatedAt
  WHERE id = @id
`);
```

### C.5 Nuevo endpoint: `PUT /api/profiles/:id/layout`

```
PUT /api/profiles/:id/layout
Body: { layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }> }
Response: { ok: true, data: Profile }
```

Este endpoint actualiza solo el `buttonLayout` del perfil sin afectar `buttons` ni otras propiedades. Se implementa en `server/routes/profiles.ts` (o en un archivo nuevo `server/routes/layout.ts`).

El endpoint existente `PUT /api/device/:id/layout` se **mantiene** para retrocompatibilidad y sigue escribiendo en `devices.metadata.buttonLayout`, pero el `LayoutEditor` dejará de usarlo.

### C.6 Cambios en `LayoutEditor.tsx`

**Estado inicial del draft**: en vez de leer `device.buttons[].layoutX/Y`, leer `activeProfile.buttonLayout`:

```typescript
// Antes:
const [draftLayout, setDraftLayout] = useState<Record<number, LayoutEntry>>(() => {
  if (!device) return {};
  const initial: Record<number, LayoutEntry> = {};
  for (const btn of device.buttons) {
    if (btn.layoutX !== undefined && btn.layoutY !== undefined) {
      initial[btn.cid] = { x: btn.layoutX, y: btn.layoutY, labelSide: btn.labelSide };
    }
  }
  return initial;
});

// Después:
const { activeProfile } = useAppContext(); // nuevo: exponer activeProfile (Profile | null)
const [draftLayout, setDraftLayout] = useState<Record<number, LayoutEntry>>(() => {
  // Prioridad 1: buttonLayout del perfil activo
  if (activeProfile?.buttonLayout) {
    return { ...activeProfile.buttonLayout };
  }
  // Prioridad 2: layout del device (fallback retrocompatibilidad)
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

**handleSave**: llamar al nuevo endpoint de perfil en vez del de device:

```typescript
// Antes:
await saveDeviceLayout(device.unitId, draftLayout);

// Después:
await saveProfileLayout(activeProfileId, draftLayout);
```

**Texto del banner**: `"LAYOUT EDIT MODE — guardando en perfil: {activeProfile.name}"`

### C.7 Cambios en `AppContext.tsx`

**`selectProfile()`**: al seleccionar un perfil, aplicar su `buttonLayout` para que `MousePreview` muestre los botones en las posiciones correctas. Los botones del device se "decoran" con las posiciones del perfil:

```typescript
const selectProfile = useCallback((id: string) => {
  setActiveProfileId(id);
  const profile = profiles.find(p => p.id === id);
  if (profile) {
    setButtons([...profile.buttons]);
    // Actualizar device con el layout del perfil activo
    if (device && profile.buttonLayout) {
      const updatedDevice = applyProfileLayoutToDevice(device, profile.buttonLayout);
      setDevice(updatedDevice);
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

Donde `applyProfileLayoutToDevice` es una función pura (no un hook) que devuelve un nuevo `KnownDevice` con los `layoutX/Y` de los botones actualizados desde el `buttonLayout` del perfil:

```typescript
function applyProfileLayoutToDevice(
  device: KnownDevice,
  layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>
): KnownDevice {
  return {
    ...device,
    buttons: device.buttons.map(btn => {
      const pos = layout[btn.cid];
      if (pos) {
        return { ...btn, layoutX: pos.x, layoutY: pos.y, ...(pos.labelSide ? { labelSide: pos.labelSide } : {}) };
      }
      return btn;
    }),
  };
}
```

**`createNewProfile()`**: si hay `cloneFromProfileId`, clonar también `buttonLayout`:

```typescript
const profile: Profile = {
  // ...existente
  buttons: baseButtons,
  windowClasses: windowClasses?.length ? windowClasses : undefined,
  // Clonar el buttonLayout si se está clonando de otro perfil
  buttonLayout: cloneFromProfileId
    ? JSON.parse(JSON.stringify(source?.buttonLayout ?? {}))
    : undefined,
};
```

**Exponer `activeProfile`** en el contexto (actualmente no está expuesto, solo `activeProfileId`):

```typescript
// AppContextType — agregar:
activeProfile: Profile | null;
```

### C.8 Cambios en `useApi.ts`

```typescript
// Nuevo:
export function saveProfileLayout(
  profileId: string,
  layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>,
): Promise<Profile> {
  return api<Profile>(`/profiles/${profileId}/layout`, {
    method: 'PUT',
    body: JSON.stringify({ layout }),
  });
}

// Nuevo:
export function fetchInstalledApps(): Promise<InstalledApp[]> {
  return api<InstalledApp[]>('/installed-apps');
}
```

---

## Mock Mode (SPEC-11 update)

El mock router (`server/mock/routes.ts`) necesita manejar los nuevos endpoints:

### Mock: `GET /api/installed-apps`

```typescript
router.get('/installed-apps', (_req, res) => {
  res.json({
    ok: true,
    data: [
      { name: 'Firefox Web Browser', execName: 'firefox', windowClass: 'Navigator', iconName: 'firefox' },
      { name: 'Google Chrome', execName: 'google-chrome', windowClass: 'google-chrome', iconName: 'google-chrome' },
      { name: 'Visual Studio Code', execName: 'code', windowClass: 'code', iconName: 'vscode' },
      { name: 'VLC Media Player', execName: 'vlc', windowClass: 'vlc', iconName: 'vlc' },
      { name: 'Spotify', execName: 'spotify', windowClass: 'Spotify', iconName: 'spotify' },
      { name: 'Steam', execName: 'steam', windowClass: 'Steam', iconName: 'steam' },
      { name: 'GIMP', execName: 'gimp', windowClass: 'gimp', iconName: 'gimp' },
      { name: 'Inkscape', execName: 'inkscape', windowClass: 'inkscape', iconName: 'inkscape' },
    ],
  });
});
```

### Mock: `GET /api/app-icon/:iconName`

En modo mock, devolver un placeholder SVG genérico en lugar de leer el sistema de archivos:

```typescript
router.get('/app-icon/:iconName', (req, res) => {
  // Devolver un SVG placeholder con las iniciales del iconName
  const name = req.params.iconName;
  const initials = name.slice(0, 2).toUpperCase();
  const color = stringToHslColor(name);
  const svg = `<svg ...>${initials}</svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});
```

### Mock: `PUT /api/profiles/:id/layout`

```typescript
router.put('/profiles/:id/layout', (req, res) => {
  const idx = mockProfiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Profile not found' });
  const { layout } = req.body as { layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }> };
  (mockProfiles[idx] as Profile & { buttonLayout?: unknown }).buttonLayout = layout;
  mockProfiles[idx].updatedAt = new Date().toISOString();
  res.json({ ok: true, data: mockProfiles[idx] });
});
```

### Mock data: actualizar `MOCK_PROFILES`

Agregar campos `appIcon` y `buttonLayout` a los 3 perfiles existentes para que el estado inicial de los tests sea representativo.

---

## Consideraciones de Diseño

### Por qué guardar appIcon como URL y no como base64 en la DB

Guardar base64 de un PNG de 64x64px en la DB implica ~6KB por perfil en texto. Con muchos perfiles esto encarece la respuesta del `/api/bootstrap`. Usando `"/api/app-icon/:name"` la resolución del icono es lazy y solo se carga cuando se renderiza.

Para iconos custom (no del sistema), sí se acepta data URL porque no hay forma de referenciarla de otra forma.

### Por qué no eliminar el layout de dispositivo

`devices.metadata.buttonLayout` se mantiene como fallback:
1. Retrocompatibilidad con perfiles creados antes del SPEC-12
2. Si el usuario quiere un layout "base" para todos los perfiles que no tienen uno definido, puede seguir editando el device layout

Prioridad al renderizar en `MousePreview`:
```
profile.buttonLayout[cid] > device.metadata.buttonLayout[cid] > CSS fallback por posición
```

### Stacking context de la ProfileIconBar

Al igual que el `Topbar`, la `ProfileIconBar` usa `position: sticky` y `backdrop-filter`. Los modales que se abran desde la icon bar (modal "New Profile") deben usar `ReactDOM.createPortal(modal, document.body)` para evitar que sean recortados por el stacking context. Ver SPEC-11 para el patrón establecido en `Topbar.tsx`.

### Desactivar ProfileIconBar en Layout Edit Mode

Cuando `isLayoutEditMode === true`, la icon bar se deshabilita (los clics no hacen nada y se muestra con `opacity: 0.4; pointer-events: none`) para evitar que el usuario cambie de perfil mientras edita el layout, lo que produciría inconsistencias en el draft.

---

## Archivos a Crear

| Archivo | Propósito |
|---|---|
| `src/components/ProfileIconBar.tsx` | Barra de iconos de perfiles |
| `src/components/ProfileIconBar.css` | Estilos de la barra |
| `server/services/appScanner.ts` | Parseo de archivos .desktop del sistema |

---

## Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `server/types.ts` | Agregar `appIcon?` y `buttonLayout?` a `Profile` |
| `src/types.ts` | Ídem |
| `server/db/schema.sql` | Documentar las nuevas columnas (el ALTER se hace en db/index.ts) |
| `server/db/index.ts` | Migración: `ALTER TABLE profiles ADD COLUMN appIcon TEXT` + `ADD COLUMN buttonLayout TEXT` |
| `server/db/repositories/profile.repo.ts` | `ProfileRow`, `rowToProfile`, statements INSERT/UPDATE |
| `server/routes/profiles.ts` | Nuevo endpoint `PUT /api/profiles/:id/layout` |
| `server/routes/` | Nuevos endpoints `GET /api/installed-apps` y `GET /api/app-icon/:iconName` (puede ir en un nuevo archivo `server/routes/apps.ts`) |
| `server/index.ts` | Registrar router de `apps.ts` |
| `server/mock/routes.ts` | Endpoints mock de installed-apps, app-icon, profiles/:id/layout |
| `server/mock/data.ts` | Añadir `appIcon` y `buttonLayout` a MOCK_PROFILES |
| `src/hooks/useApi.ts` | `saveProfileLayout()`, `fetchInstalledApps()` |
| `src/context/AppContext.tsx` | `selectProfile()` + `createNewProfile()` + exponer `activeProfile` |
| `src/components/Topbar.tsx` | Eliminar selector de perfiles + botón `+` del topbar (pasan a ProfileIconBar) |
| `src/components/LayoutEditor.tsx` | Usar `activeProfile.buttonLayout` para draft inicial; guardar en perfil |
| `src/App.tsx` | Montar `<ProfileIconBar />` entre Topbar y app-body |
