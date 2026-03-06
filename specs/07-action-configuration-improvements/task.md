# Spec 07 — Action Configuration Improvements

## Contexto

LogiTux permite asignar acciones a botones del mouse Logitech vía Solaar.
Existen dos modos de configuración por botón:

- **Simple Action** — una sola acción al hacer click (KeyPress, MouseClick, Execute, etc.)
- **Mouse Gestures** — hasta 5 acciones (click + 4 direcciones) activadas al mover el mouse con el botón presionado

También existe el **ComboBuilder**, un picker visual de teclas para construir combinaciones de teclas sin tener que presionarlas físicamente.

Este spec agrupa mejoras de UX y bugs en el flujo de configuración de acciones.

---

## Problemas Actuales

### BUG-01: Simple Action no funciona al aplicar

**Severidad**: Crítica

Cuando el usuario configura un botón en modo "Simple Action" y hace Apply, la acción no se ejecuta en el mouse.

**Root cause**: El frontend setea `divertKeys[cid] = 1` (Diverted) para simple actions, pero el parser genera reglas con condición `MouseGesture: ButtonName` que solo se dispara en modo `2` (Mouse Gestures diverted). Solaar mode `1` no genera eventos MouseGesture, por lo tanto la regla nunca matchea.

**Archivo**: `src/context/AppContext.tsx` línea ~270
```typescript
// Actual — roto:
} else if (btn.simpleAction.type !== 'None') {
    divertKeys[btn.cid] = 1;  // ❌ mode 1 no dispara MouseGesture
}

// Fix:
} else if (btn.simpleAction.type !== 'None') {
    divertKeys[btn.cid] = 2;  // ✅ mode 2 permite MouseGesture click
}
```

### BUG-02: Resolución ambigua entre tabs Simple Action y Mouse Gestures

Cuando un botón soporta ambos modos, el usuario puede configurar algo en "Simple Action", cambiar a la tab "Mouse Gestures" y configurar cosas ahí también. El `gestureMode` boolean determina cuál se usa, pero:

- No hay indicación visual de que la otra tab tiene datos configurados
- Si el usuario configura Simple Action, cambia a Mouse Gestures (sin configurar nada ahí) y aplica, `gestureMode=true` se activa y manda gestos vacíos → la acción se pierde
- Comportamiento esperado: al aplicar se debería usar la **última tab activa**, y debería haber un indicador si ambas tabs tienen configuración

### BUG-03: ComboBuilder no respeta orden de teclas

**Severidad**: Menor (UX)

El ComboBuilder usa un `Set<string>` para modifiers y en `buildCombo()` itera la constante `MODIFIERS` en orden fijo (Ctrl → Shift → Alt → Super). Si el usuario selecciona Alt primero y Ctrl después, el combo sale como `Ctrl + Alt + key` en vez de `Alt + Ctrl + key`.

**Nota**: Para Solaar el orden de modifiers es irrelevante (la tecla se envía como combinación), pero **visualmente** el usuario espera ver el orden en que clickeó.

---

## Mejoras Propuestas

### Tier 1 — Fixes Críticos (deben resolverse antes de cualquier mejora)

| ID | Descripción | Archivos |
|----|-------------|----------|
| FIX-01 | Cambiar `divertKeys[cid] = 1` a `2` para simple actions | `src/context/AppContext.tsx` |
| FIX-02 | Sincronizar `gestureMode` con la tab activa al cambiar tabs | `src/components/ActionConfigurator.tsx` |
| FIX-03 | Indicador visual cuando ambas tabs tienen config ("●" dot) | `src/components/ActionConfigurator.tsx`, CSS |

### Tier 2 — ComboBuilder UX

| ID | Descripción | Archivos |
|----|-------------|----------|
| CB-01 | Preservar orden de selección de modifiers (usar array en vez de Set) | `ComboBuilder.tsx` |
| CB-02 | Botón "Clear" para resetear combo | `ComboBuilder.tsx` |
| CB-03 | Enter para confirmar, Escape para cancelar (keyboard shortcuts) | `ComboBuilder.tsx` |
| CB-04 | Grupo de teclas de Puntuación (semicolon, comma, brackets, etc.) | `ComboBuilder.tsx` |
| CB-05 | Grupo de teclas Numpad (KP_0..KP_9, KP_Enter, etc.) | `ComboBuilder.tsx` |
| CB-06 | Búsqueda/filtro en el grid de teclas | `ComboBuilder.tsx` |
| CB-07 | Presets de combos comunes (Ctrl+C, Ctrl+V, Ctrl+T, etc.) | `ComboBuilder.tsx` |

### Tier 3 — Polish

| ID | Descripción | Archivos |
|----|-------------|----------|
| PL-01 | Recently used keys (localStorage) | `ComboBuilder.tsx` |
| PL-02 | Live YAML preview del combo | `ComboBuilder.tsx` |
| PL-03 | Theme-aware colors (dark/light) | `ComboBuilder.css` |
| PL-04 | A11y — keyboard grid navigation (arrow keys + space) | `ComboBuilder.tsx` |

---

## Criterios de Aceptación

- [ ] Simple Action configurada y aplicada ejecuta correctamente la acción en el mouse
- [ ] Cambiar de tab Simple→Gestures (o viceversa) y aplicar usa la config de la tab activa
- [ ] ComboBuilder muestra las teclas en el orden en que se seleccionaron
- [ ] ComboBuilder tiene Clear, Enter/Escape, y grupos Punctuation/Numpad
- [ ] Tests existentes siguen pasando (148+)
