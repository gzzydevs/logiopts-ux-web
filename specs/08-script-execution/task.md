# Spec 08 — Custom Script Execution via Mouse Buttons

## Contexto

LogiTux ya tiene la infraestructura base para ejecutar scripts:
- `scripts/` — scripts de shell precargados (volume.sh, brightness.sh, etc.)
- `server/db/repositories/script.repo.ts` — CRUD SQLite de scripts
- `server/routes/scripts.ts` — endpoints REST para gestionar scripts
- `server/services/scriptRunner.ts` — ejecutor seguro de scripts (whitelist, flatpak-spawn)
- `server/services/keyListener.ts` — interceptor global de keycode via `xinput test-xi2`
- `server/services/profileApplier.ts` — `handleMacroKey()` que conecta la tecla con el script

Lo que falta es conectar todo esto con la UI de configuración de botones de manera completa y robusta.

---

## Objetivo

Permitir que el usuario asigne un script bash custom a cualquier botón del mouse (o dirección gestura), con un flujo de UI claro: picker → editor in-browser → aplicar.

---

## Análisis de las dos opciones de integración con Solaar

### Opción A — Solaar `Execute` action (nativo)

Solaar soporta una acción `Execute: [comando]` en rules.yaml que ejecuta un proceso directamente.

**Ventajas:**
- Sin intermediarios — Solaar ejecuta el proceso directamente al detectar el click.
- No requiere que el servidor esté escuchando teclas.

**Desventajas críticas:**
- Solaar corre como el usuario actual pero desde un contexto D-Bus/systemd — no tiene acceso a variables de entorno del escritorio (`$DISPLAY`, `$WAYLAND_DISPLAY`, `$PULSE_SERVER`), haciendo que scripts que abren ventanas o controlan audio fallen silenciosamente.
- El path del script es hardcodeado en rules.yaml — si el usuario mueve la instalación, se rompe.
- No hay forma de capturar stdout/stderr para mostrarlo en la UI.
- **No funciona con el sandbox de Flatpak** donde suele correr Solaar.

### Opción B — Macro key interception (implementación actual, recomendada)

El botón del mouse se configura en Solaar para emitir un `KeyPress` de una tecla "libre" (F12–F15, etc.). El servidor intercepta esa tecla con `xinput test-xi2` y ejecuta el script mapeado.

**Ventajas:**
- El servidor corre en el contexto completo del usuario — tiene acceso a todas las variables de entorno.
- Los paths de scripts son internos a la app, no expuestos a Solaar.
- Se puede capturar output y mostrarlo en la UI via WebSocket.
- El usuario puede reutilizar la misma tecla macro en múltiples perfiles.
- **Ya está parcialmente implementado** en `server/services/keyListener.ts` y `server/services/profileApplier.ts`.

**Desventajas:**
- Requiere que el servidor esté corriendo.
- Hay un pool limitado de "macro keys" disponibles (F12–F20 son teclas que nada usa normalmente).

**Decisión: Opción B** — más robusta, ya tiene base de código, y es la única que funciona correctamente en entornos Flatpak/sandbox.

---

## Problemas Actuales a Resolver

### SCRIPT-01: `RunScript` removido de `server/types.ts` pero no de `src/types.ts`

En la sesión anterior se hizo un stash que reintrodujo los cambios. El tipo `RunScript` existe en `src/types.ts` y el servidor en `server/types.ts`. Hay que reconciliar y completar la implementación en lugar de eliminar el tipo.

### SCRIPT-02: Macro keys hardcodeadas en `keyListener.ts`

```typescript
private keyMap: Record<number, string> = {
    96: 'F12',
    191: 'F13',
    192: 'F14',
    193: 'F15',
};
```

El pool de teclas disponibles está hardcodeado. El usuario no puede elegir qué tecla usa para su script. Además, los keycodes de F13-F15 varían por distribución de teclado.

### SCRIPT-03: `scriptRunner.ts` tiene lista blanca hardcodeada

```typescript
const ALLOWED_SCRIPTS = ['apply-solaar.sh', 'reset-solaar.sh', ...];
```

Los scripts creados por el usuario no pasan la whitelist y el runner los rechaza.

### SCRIPT-04: No hay UI para asignar scripts a botones

En `ActionPicker.tsx` el tipo `RunScript` no tiene un picker dedicado — solo muestra el nombre del script como texto. No hay forma de:
- Seleccionar un script del listado
- Elegir la macro key asignada
- Ver/editar el script inline

### SCRIPT-05: No hay editor in-browser

El usuario no puede crear ni editar scripts desde la UI. Debe hackear los archivos manualmente.

---

## Mejoras Propuestas

### Tier 1 — Funcionalidad core

**T1-01: Reconciliar tipos `RunScript`**  
`server/types.ts` y `src/types.ts` deben ser iguales. El tipo debe ser:
```typescript
| { type: 'RunScript'; scriptId: string; macroKey: string }
```
Cambiar `script` (nombre) por `scriptId` (UUID del DB) — más robusto ante renames.

**T1-02: Macro key pool dinámico**  
- Permitir que el usuario elija la macro key de un pool predefinido seguro: `F13, F14, F15, F16, F17, F18, F19, F20` (teclas que raramente tienen bindings en el sistema)
- El `keyListener` debe registrar las teclas que están realmente en uso leyendo los perfiles activos
- Detectar conflictos: si F14 ya está usada por otro botón, advertir al usuario

**T1-03: `scriptRunner.ts` — lista blanca dinámica desde DB**  
En lugar de una whitelist hardcodeada, verificar que el script existe en la tabla `scripts` del DB y tiene `executable = true`. Mantener los patrones de seguridad (`DANGEROUS_PATTERNS`) para scripts creados por el usuario.

**T1-04: Editor in-browser con CodeMirror 6**  
Integrar [CodeMirror 6](https://codemirror.net/) como editor in-browser:
- Bundle size: ~150KB adicionales con `@codemirror/lang-shell`
- MIT license, mantenido activamente, sin deps pesadas
- Features mínimas: syntax highlighting bash, line numbers, dark theme
- **No** Monaco Editor (5MB+, demasiado pesado para este uso)

### Tier 2 — UX

**T2-01: Script picker en ActionPicker**  
Cuando el tipo de acción es `RunScript`, mostrar:
- Dropdown con scripts disponibles del DB
- Preview del script seleccionado (primeras 3 líneas)
- Botón "✏️ Editar" que abre el modal del editor
- Selector de macro key con indicador de estado (libre/ocupada)

**T2-02: Script Manager Modal**  
Nueva sección o modal accesible desde `SettingsPanel` y desde el picker:
- Lista de scripts con nombre, path, fecha de actualización
- Botón "Nuevo script" con template básico de bash
- Botón "Editar" → abre editor CodeMirror
- Toggle "Ejecutable (chmod +x)" con estado visual
- Botón "Test" → ejecuta el script y muestra output en panel inline
- Botón "Eliminar" con confirmación

**T2-03: Output en tiempo real via WebSocket**  
Cuando se ejecuta un script (por botón del mouse o por "Test"), mostrar stdout/stderr en un panel flotante en la UI. Usar el WebSocket existente (`/ws`) para transmitir el output.

**T2-04: Indicador visual del modo RunScript en el botón del mouse**  
En `MousePreview.tsx`, los botones con acción `RunScript` deben mostrar un ícono de terminal `>_` superpuesto sobre el botón SVG.

---

## Scope Excluido

- Soporte para scripts en lenguajes distintos a bash/sh
- Ejecución de scripts con privilegios elevados (sudo)
- Scheduler / cron para scripts
- Opción A (Solaar Execute) — descartada por las razones técnicas descritas arriba

---

## Dependencias Externas

| Paquete | Versión | Licencia | Motivo |
|---|---|---|---|
| `@codemirror/view` | ^6.x | MIT | Core del editor |
| `@codemirror/state` | ^6.x | MIT | State management del editor |
| `@codemirror/lang-shell` | ^6.x | MIT | Syntax highlighting bash |
| `@codemirror/theme-one-dark` | ^6.x | MIT | Tema oscuro |

Total overhead estimado: ~180KB minificado, ~55KB gzip.

---

## Archivos a Modificar / Crear

**Backend:**
- `server/types.ts` — reconciliar `RunScript`, cambiar `script` → `scriptId`
- `server/services/keyListener.ts` — macro key pool dinámico
- `server/services/scriptRunner.ts` — whitelist dinámica desde DB
- `server/services/profileApplier.ts` — lookup por `scriptId` en lugar de nombre

**Frontend:**
- `src/types.ts` — reconciliar con server
- `src/components/ActionPicker.tsx` — script picker con macro key selector
- `src/components/ScriptEditor.tsx` — **nuevo** modal con CodeMirror
- `src/components/ScriptManager.tsx` — **nuevo** sección de gestión
- `src/components/MousePreview.tsx` — ícono `>_` para botones RunScript
- `src/hooks/useApi.ts` — endpoints de scripts (ya existentes, agregar hooks)
