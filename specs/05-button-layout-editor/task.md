# Task List — Button Layout Editor

## Phase 1 — Data Model
- [ ] Agregar `layoutX?: number` y `layoutY?: number` a `KnownButton` en `server/types.ts`
- [ ] Agregar `buttonLayout?: Record<number, { x: number; y: number }>` a `DeviceMetadata` en `server/types.ts`
- [ ] Agregar `updateDeviceLayout(deviceId, layout)` en `server/db/repositories/device.repo.ts`
- [ ] Hacer que `upsertDevice` no pise el `buttonLayout` existente si no se pasa nuevo
- [ ] Espejo en `src/types.ts` frontend: agregar `layoutX?` y `layoutY?` a `KnownButton`

## Phase 2 — Backend
- [ ] Agregar `PUT /api/device/:id/layout` en `server/routes/buttons.ts`
- [ ] Agregar `saveDeviceLayout(deviceId, layout)` en `src/hooks/useApi.ts`

## Phase 3 — MousePreview dinámico
- [ ] En `MousePreview.tsx`, leer `btn.layoutX/Y` y aplicar como `style` inline si existen
- [ ] Mantener clase CSS como fallback cuando no hay layout guardado
- [ ] Aceptar prop `editMode: boolean` — en modo edición mostrar TODOS los botones

## Phase 4 — Layout Editor
- [ ] Crear `src/components/LayoutEditor.tsx` con drag & drop HTML5 nativo
- [ ] Calcular posición % relativa al canvas en `onDrop`
- [ ] Estado local `draftLayout` para preview antes de guardar
- [ ] Botones `Save Layout` y `Cancel` en el componente
- [ ] Crear `src/components/LayoutEditor.css`
- [ ] Evalurar si `@dnd-kit/core` es necesario o es suficiente con eventos nativos

## Phase 5 — Activación
- [ ] Agregar `isLayoutEditMode` + `setLayoutEditMode` a `AppContext.tsx`
- [ ] Agregar botón `✏️ Layout` en `Topbar.tsx`
- [ ] En modo edición, mostrar badge `EDIT MODE` en el topbar
- [ ] Pasar `editMode` prop a `MousePreview` → `LayoutEditor`

## Phase 6 — Device Image (opcional)
- [ ] En `MousePreview`, renderizar `<img>` si `device.image` está definido
- [ ] Agregar endpoint `POST /api/device/:id/image` para subir imagen
- [ ] UI para subir imagen desde la app
