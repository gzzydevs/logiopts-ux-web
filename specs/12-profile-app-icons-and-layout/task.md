# SPEC-12 — Task Checklist

> ⚡ Usar `npm run dev:cloud` para levantar servidor mock (sin hardware). UI disponible en `http://localhost:5173`. Compatible con Playwright.

---

## Fase 1 — Tipos

- [ ] **1.1** Agregar `appIcon?: string` y `buttonLayout?: Record<number, {x,y,labelSide?}>` a `Profile` en `server/types.ts`
- [ ] **1.2** Ídem en `src/types.ts`

---

## Fase 2 — Backend

- [ ] **2.1** `server/db/index.ts` — migraciones idempotentes: `ALTER TABLE profiles ADD COLUMN appIcon TEXT` + `ADD COLUMN buttonLayout TEXT NOT NULL DEFAULT '{}'`
- [ ] **2.2** `server/db/schema.sql` — documentar columnas nuevas en la definición de `profiles`
- [ ] **2.3** `server/db/repositories/profile.repo.ts` — actualizar `ProfileRow`, `rowToProfile()`, statements INSERT/UPDATE para incluir `appIcon` y `buttonLayout`
- [ ] **2.4** `server/routes/profiles.ts` — agregar `PUT /api/profiles/:id/layout` (actualiza solo `buttonLayout` del perfil)
- [ ] **2.5** `server/services/appScanner.ts` — nuevo servicio que parsea `.desktop` files y devuelve `InstalledApp[]`
- [ ] **2.6** `server/routes/apps.ts` — nuevo archivo con `GET /api/installed-apps` y `GET /api/app-icon/:iconName`
- [ ] **2.7** `server/index.ts` — registrar `appsRouter`
- [ ] **2.8** `server/mock/routes.ts` — añadir handlers mock para `GET /api/installed-apps`, `GET /api/app-icon/:iconName`, `PUT /api/profiles/:id/layout`
- [ ] **2.9** `server/mock/data.ts` — agregar `appIcon` y `buttonLayout` a los 3 perfiles mock existentes

---

## Fase 3 — Frontend: API layer

- [ ] **3.1** `src/hooks/useApi.ts` — agregar `saveProfileLayout(profileId, layout)` y `fetchInstalledApps()`
- [ ] **3.2** `src/hooks/useApi.ts` — exportar tipo `InstalledApp`

---

## Fase 4 — Frontend: AppContext

- [ ] **4.1** `src/context/AppContext.tsx` — exponer `activeProfile: Profile | null` en el contexto
- [ ] **4.2** `src/context/AppContext.tsx` — definir función pura `applyProfileLayoutToDevice(device, layout)` (fuera del componente)
- [ ] **4.3** `src/context/AppContext.tsx` — `selectProfile()`: llamar `applyProfileLayoutToDevice` con el layout del perfil seleccionado y actualizar `device` con `setDevice`
- [ ] **4.4** `src/context/AppContext.tsx` — `createNewProfile()`: clonar `appIcon` y `buttonLayout` del perfil fuente si `cloneFromProfileId` está presente
- [ ] **4.5** `src/context/AppContext.tsx` — handler SSE `profile-switched`: aplicar `buttonLayout` del nuevo perfil al device

---

## Fase 5 — Frontend: LayoutEditor

- [ ] **5.1** `src/components/LayoutEditor.tsx` — leer `activeProfile` del contexto
- [ ] **5.2** `src/components/LayoutEditor.tsx` — estado inicial del draft: priorizar `activeProfile.buttonLayout` sobre `device.buttons[].layoutX/Y`
- [ ] **5.3** `src/components/LayoutEditor.tsx` — `handleSave`: usar `saveProfileLayout(activeProfileId, draftLayout)` en vez de `saveDeviceLayout`
- [ ] **5.4** `src/components/LayoutEditor.tsx` — actualizar texto del banner para indicar el perfil que se está editando

---

## Fase 6 — Frontend: ProfileIconBar

- [ ] **6.1** Crear `src/components/ProfileIconBar.tsx`
  - Listado horizontal de perfiles como items clicables
  - Icono (`<img>` si hay `appIcon`) o avatar de iniciales si no
  - Highlight del perfil activo (borde inferior + fondo)
  - Botón `+` al final para crear nuevo perfil
  - Deshabilitar toda interacción cuando `isLayoutEditMode === true`
  - Micro-botones de editar/borrar en hover
- [ ] **6.2** Crear `src/components/ProfileIconBar.css` con los estilos completos de la barra
- [ ] **6.3** Mover la lógica del modal "New Profile" del Topbar al ProfileIconBar
  - Estados: `showNewProfile`, `newName`, `newWindowClasses`, `cloneFromId`
  - Handler `handleCreateProfile`
  - Renderizado via `createPortal(modal, document.body)`
- [ ] **6.4** Agregar sección de selección de app icon en el modal "New Profile"
  - Input de búsqueda de apps instaladas (lazy: carga al hacer focus)
  - Lista filtrable de apps con su icono
  - Al seleccionar app: pre-rellenar `windowClasses` con el `windowClass` de la app
  - Vista previa del icono seleccionado
  - Fallback: input URL manual si no hay apps instaladas o el sistema no es Linux

---

## Fase 7 — Frontend: Topbar cleanup

- [ ] **7.1** `src/components/Topbar.tsx` — eliminar bloque `<div className="profiles-selector">` (dropdown + botones + / trash)
- [ ] **7.2** `src/components/Topbar.tsx` — eliminar estados y handlers del modal de creación de perfil (movidos a ProfileIconBar)
- [ ] **7.3** `src/components/Topbar.tsx` — eliminar imports de `createNewProfile`, `deleteCurrentProfile` si ya no se usan

---

## Fase 8 — App.tsx

- [ ] **8.1** `src/App.tsx` — importar y montar `<ProfileIconBar />` entre `<Topbar />` y `<div className="app-body">`

---

## Fase 9 — Tests

- [ ] **9.1** `server/services/__tests__/appScanner.test.ts` — tests unitarios del parser de `.desktop` files (mock de fs)
- [ ] **9.2** `server/db/__tests__/profile.repo.test.ts` — extender con tests para `appIcon` y `buttonLayout`
- [ ] **9.3** Test de `applyProfileLayoutToDevice` (puede ser un test unitario puro)

---

## Verificación Final

- [ ] Con `npm run dev:cloud`: ProfileIconBar visible con 3 perfiles (Default / Gaming / Media)
- [ ] Click en icono de perfil → highlight cambia, MousePreview actualiza botones
- [ ] Layout Edit Mode → mover botón → Save → cambiar perfil → volver → posición preservada
- [ ] Clone from copia `buttonLayout` del perfil fuente
- [ ] Modal "New Profile" permite buscar y seleccionar una app instalada (mock: Firefox/Chrome/VLC/etc.)
- [ ] Al seleccionar una app, se pre-rellena la windowClass
- [ ] El Topbar ya no muestra el dropdown de perfiles
