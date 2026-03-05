# Implementation Plan — Interactive Button Layout Editor

## Resumen

Implementar un modo de edición visual donde el usuario pueda arrastrar los botones del mouse sobre su imagen real para guardar las posiciones en la DB. Las posiciones se usan en el `MousePreview` en lugar de las coordenadas CSS hardcodeadas.

---

## Phase 1 — Data Model

**Objetivo**: Extender el modelo de datos para soportar posiciones de layout por dispositivo.

### 1.1 Extender tipos `server/types.ts`

- Agregar `layoutX?: number` y `layoutY?: number` a `KnownButton`
- Agregar `buttonLayout?: Record<number, { x: number; y: number }>` a `DeviceMetadata`

### 1.2 Extender `device.repo.ts`

- Nuevo método `updateDeviceLayout(deviceId: string, layout: Record<number, { x: number; y: number }>): void`
  - Lee el device existente
  - Actualiza `metadata.buttonLayout`
  - Hace `upsertDevice` con los datos actualizados

### 1.3 Extender `src/types.ts` (frontend)

- Mismos campos `layoutX?` y `layoutY?` en el tipo `KnownButton` del frontend

---

## Phase 2 — Backend Endpoint

**Objetivo**: Exponer un endpoint para guardar el layout.

### 2.1 Nuevo endpoint `PUT /api/device/:id/layout`

En `server/routes/buttons.ts`:

```typescript
router.put('/device/:id/layout', (req, res) => {
  const { id } = req.params;
  const { layout } = req.body; // Record<number, { x: number; y: number }>
  updateDeviceLayout(id, layout);
  // Re-cargar el device y actualizar memory store
  const devices = getAllDevices();
  const device = devices.find(d => d.unitId === id);
  if (device) setCurrentDevice(device);
  res.json({ ok: true });
});
```

### 2.2 Agregar `saveDeviceLayout` a `useApi.ts`

```typescript
export function saveDeviceLayout(
  deviceId: string,
  layout: Record<number, { x: number; y: number }>
): Promise<void> {
  return api(`/device/${deviceId}/layout`, {
    method: 'PUT',
    body: JSON.stringify({ layout }),
  });
}
```

---

## Phase 3 — MousePreview con posiciones dinámicas

**Objetivo**: Leer `layoutX/Y` de cada botón si existe, en vez de usar clase CSS.

### 3.1 Modificar `MousePreview.tsx`

- Si `btn.layoutX !== undefined && btn.layoutY !== undefined`:
  - Aplicar `style={{ top: `${btn.layoutY}%`, left: `${btn.layoutX}%` }}` inline
  - No agregar clase `node-{position}`
- Si no hay layout:
  - Mantener comportamiento actual con clase CSS (`node-forward`, etc.)

### 3.2 Modo edición en `MousePreview.tsx`

- Recibir prop `editMode: boolean`
- En modo edición:
  - Mostrar TODOS los botones (incluyendo no-divertables)
  - Aplicar clase `draggable` a cada nodo
  - Mostrar overlay de instrucciones

---

## Phase 4 — Layout Editor Component

**Objetivo**: Crear el componente de edición drag & drop.

### 4.1 `LayoutEditor.tsx`

- Wrapper sobre el canvas del mouse con `position: relative`
- Cada botón tiene `draggable={true}` + handlers `onDragStart`/`onDrop`
- Calcular posición `%` relativa al canvas en el evento `onDrop`:
  ```
  x = (event.clientX - canvasRect.left) / canvasRect.width * 100
  y = (event.clientY - canvasRect.top) / canvasRect.height * 100
  ```
- Estado local `draftLayout: Record<number, { x: number; y: number }>`
- Al confirmar, llama `saveDeviceLayout(deviceId, draftLayout)`

### 4.2 `LayoutEditor.css`

- `.node.draggable` — cursor grab, sin `cursor: not-allowed`
- `.node.dragging` — opacidad 0.5 mientras se arrastra
- Overlay de instrucciones con fondo semitransparente
- Banner de modo edición

> **Alternativa**: usar `@dnd-kit/core` si los eventos HTML5 drag resultan problemáticos con `position: absolute`.

---

## Phase 5 — UI de activación

**Objetivo**: Permitir al usuario entrar/salir del modo edición.

### 5.1 `AppContext.tsx`

- Agregar `isLayoutEditMode: boolean` al estado
- Agregar `setLayoutEditMode: (v: boolean) => void`

### 5.2 `Topbar.tsx`

- Agregar botón `✏️ Layout` (pequeño, tipo ghost)
- Al clickear, activa `setLayoutEditMode(true)`
- En modo edición, el topbar muestra un badge `EDIT MODE` y el botón cambia a `✖ Exit`

---

## Phase 6 — Device Image Support

**Objetivo**: Soporte para imagen real del mouse (opcional, mejora visual).

### 6.1 Campo `image` en `devices` table (ya existe)

- Por ahora puede ser una URL o path a un SVG/PNG
- En `MousePreview`, si `device.image` está definido:
  - Usar `<img src={device.image}>` en lugar de `<GenericMouseSVG />`

### 6.2 Endpoint para subir imagen (opcional)

```
POST /api/device/:id/image
Body: FormData con el archivo
```

---

## Orden sugerido de implementación

1. **Phase 1** — Tipos y repo (sin UI, solo datos)
2. **Phase 2** — Endpoint backend
3. **Phase 3** — MousePreview lee layout dinámico
4. **Phase 4** — LayoutEditor básico con drag nativo
5. **Phase 5** — Activación desde Topbar
6. **Phase 6** — (Opcional) imagen real del device

---

## Dependencias externas consideradas

| Lib | ¿Necesaria? | Alternativa |
|---|---|---|
| `@dnd-kit/core` | Opcional | HTML5 drag events nativos |
| Ninguna otra nueva | — | — |
