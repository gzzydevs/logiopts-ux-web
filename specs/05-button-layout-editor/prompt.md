# 🖱️ Spec 05 — Interactive Button Layout Editor

## Problema actual

El `MousePreview` posiciona los botones con coordenadas CSS hardcodeadas en `MousePreview.css`:

```css
.node-forward { top: 43%; left: 18%; }
.node-back    { top: 55%; left: 18%; }
.node-middle  { top: 26%; left: 46%; }
.node-shift   { top: 50%; left: 46%; }
```

Este approach tiene varios problemas:

1. **Los mouses son todos diferentes.** Un MX Master 3, un Logitech G502, un Anywhere 3 tienen layouts completamente distintos.
2. **Los botones no divertables (Left Click, Right Click) están ocultos** porque no hay forma de posicionarlos bien sin que se superpongan.
3. **Agregar un nuevo mouse al `KNOWN_DEVICES`** requiere editar CSS a mano y adivinar los porcentajes.
4. **No hay imagen real** del mouse como fondo — se usa un SVG genérico igual para todos.

---

## Objetivo

Implementar un **editor visual de layout** que permita:

1. Usar la **imagen real del mouse** (o SVG) como fondo del canvas.
2. **Posicionar cada botón** arrastrándolo sobre esa imagen con drag & drop.
3. **Guardar las posiciones** en la DB por dispositivo.
4. Tener un **modo edición** activable desde la UI, separado del modo normal de configuración.
5. Las posiciones guardadas se aplican al renderizar el `MousePreview` para cualquier usuario del mismo dispositivo.

---

## Diseño esperado

### Modo normal (actual)
Los botones se renderizan en sus posiciones guardadas. Nada cambia visualmente.

### Modo edición (nuevo)
- Aparece un banner/badge `✏️ Layout Edit Mode`
- Los botones se vuelven **draggables** — el usuario los arrastra sobre la imagen del mouse
- Al soltar, se guarda la posición `{ x: number, y: number }` en porcentaje del canvas (0..100)
- Un botón `Save Layout` persiste las posiciones a la DB
- Un botón `Cancel` descarta los cambios

---

## Stack técnico

- **Drag & drop**: usar `@dnd-kit/core` (ya testeado en React) o HTML5 drag events nativos
- **Posiciones**: `{ x: number, y: number }` en `%` relativo al canvas de 400×600px
- **Persistencia**: nueva columna `buttonLayout` en la tabla `devices` (JSON)
- **Imagen del mouse**: campo `image` ya existe en la tabla `devices` — soportar SVG y WebP/PNG

---

## Estructura de datos

### `KnownButton` (extender)

```typescript
interface KnownButton {
  cid: number;
  name: string;
  position: string;      // existente (fallback descriptivo: 'forward', 'left', etc.)
  layoutX?: number;      // nuevo: % horizontal en canvas (0..100)
  layoutY?: number;      // nuevo: % vertical en canvas (0..100)
  // ...resto igual
}
```

### `DeviceMetadata` (extender)

```typescript
interface DeviceMetadata {
  // ...existente
  buttonLayout?: Record<number, { x: number; y: number }>; // cid → posición
}
```

### Endpoint nuevo

```
PUT /api/device/:id/layout
Body: { layout: Record<number, { x: number; y: number }> }
```

---

## Componentes a crear / modificar

| Componente | Acción |
|---|---|
| `MousePreview.tsx` | Leer `layoutX/Y` de cada botón para posicionar; si no hay, usar CSS fallback |
| `LayoutEditor.tsx` | Nuevo componente: modo edición con drag & drop |
| `LayoutEditor.css` | Estilos del modo edición |
| `device.repo.ts` | Nuevo método `updateDeviceLayout(id, layout)` |
| `server/routes/buttons.ts` | Nuevo endpoint `PUT /api/device/:id/layout` |
| `useApi.ts` | Nueva función `saveDeviceLayout(deviceId, layout)` |
| `AppContext.tsx` | Exponer `isLayoutEditMode`, `setLayoutEditMode` |

---

## UX Flow

```
[Topbar] → botón "✏️ Edit Layout"
    ↓
MousePreview entra en modo edición
    ↓
Usuario arrastra botones sobre la imagen del mouse
    ↓
[Save Layout] → PUT /api/device/:id/layout
    ↓
Posiciones guardadas en DB
    ↓
MousePreview sale de modo edición y re-renderiza con nuevas posiciones
```

---

## Consideraciones

- **Imagen del mouse**: actualmente se usa `GenericMouseSVG`. En el futuro, el campo `devices.image` podría ser una URL a un SVG/PNG real del modelo. El editor debe funcionar con ambos.
- **Fallback**: si no hay `layoutX/Y` guardado, el sistema usa `guessPosition()` y la clase CSS como ahora.
- **Botones no divertables**: en modo edición, SE MUESTRAN TODOS los botones (incluyendo Left/Right Click) para que el usuario pueda posicionarlos. En modo normal, se pueden seguir ocultando.
- **Multi-device**: las posiciones son por `deviceId`, no globales.
