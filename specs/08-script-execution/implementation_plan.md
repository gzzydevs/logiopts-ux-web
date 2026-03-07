# Spec 08 — Implementation Plan: Custom Script Execution

## Fase 1 — Reconciliar tipos y backend (sin breaking changes en UI)

### 1.1 Reconciliar `RunScript` en ambos `types.ts`

**Cambio en `server/types.ts`:**
```typescript
// Reemplazar:
// | { type: 'Execute'; command: string[] }
// Con: mantener Execute Y agregar RunScript
| { type: 'Execute'; command: string[] }
| { type: 'RunScript'; scriptId: string; macroKey: string }
```

**Cambio en `src/types.ts`:**
Sincronizar con server — usar `scriptId: string` en lugar de `script: string`.

**Nota**: `scriptId` es el UUID de la tabla `scripts` en SQLite. Esto evita que renombrar un script rompa la configuración de botones.

---

### 1.2 `scriptRunner.ts` — whitelist dinámica

**Archivo**: `server/services/scriptRunner.ts`

Reemplazar la constante `ALLOWED_SCRIPTS` con una verificación contra el DB:

```typescript
import { getScriptById } from '../db/repositories/script.repo.js';

export function runScript(scriptId: string, args: string[] = [], stdin?: string): Promise<string> {
  const script = getScriptById(scriptId);
  if (!script) throw new Error(`Script not found: ${scriptId}`);
  if (!script.executable) throw new Error(`Script is not executable: ${script.name}`);
  
  // script.path es absoluto, generado por script.repo al guardar en disco
  return new Promise((res, rej) => {
    const child = execFile('flatpak-spawn', ['--host', 'bash', script.path, ...args], 
      { timeout: 10000 }, 
      (err, stdout, stderr) => {
        if (err) return rej(new Error(stderr || err.message));
        res(stdout.trim());
      });
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}
```

Mantener el sistema de `DANGEROUS_PATTERNS` en `script.repo.ts` (ya existe).

---

### 1.3 `profileApplier.ts` — lookup por scriptId

**Archivo**: `server/services/profileApplier.ts`

```typescript
// Cambiar:
if (action.type === 'RunScript' && action.macroKey === macroKey) {
    runScript(action.script).catch(e => console.error(e));

// Por:
if (action.type === 'RunScript' && action.macroKey === macroKey) {
    runScript(action.scriptId).catch(e => console.error(e));
```

---

### 1.4 `keyListener.ts` — macro key pool dinámico

**Archivo**: `server/services/keyListener.ts`

Agregar método `setActiveMacroKeys(keys: string[])` que actualiza el `keyMap` en runtime:

```typescript
// Keycodes X11 de F13-F20 (son estándar en Xorg):
const MACRO_KEY_POOL: Record<string, number> = {
  F13: 191,
  F14: 192,
  F15: 193,
  F16: 194,
  F17: 195,
  F18: 196,
  F19: 197,
  F20: 198,
};

setActiveMacroKeys(keys: string[]) {
  this.keyMap = {};
  for (const key of keys) {
    const code = MACRO_KEY_POOL[key];
    if (code) this.keyMap[code] = key;
  }
}
```

Llamar a `setActiveMacroKeys` desde `server/index.ts` al cargar perfiles, y al guardar cambios de configuración.

Exportar `MACRO_KEY_POOL` para que el frontend pueda listar las opciones disponibles.

---

## Fase 2 — API endpoints

### 2.1 Nuevo endpoint: `GET /api/scripts/macro-keys`

Devuelve el pool de macro keys disponibles y cuáles ya están en uso:

```typescript
// Response:
{
  ok: true,
  data: {
    available: ['F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20'],
    inUse: { 'F13': 'button-cid-83', 'F14': 'button-cid-86' }
  }
}
```

### 2.2 Nuevo endpoint: `POST /api/scripts/:id/test`

Ejecuta el script y devuelve stdout/stderr. Para el output en tiempo real, usar streaming response (chunked transfer) o un evento WebSocket.

```typescript
router.post('/scripts/:id/test', async (req, res) => {
  // Validar que el script existe y es ejecutable
  // Ejecutar con runScript()
  // Devolver { ok, output, exitCode }
});
```

---

## Fase 3 — Frontend

### 3.1 Instalar CodeMirror 6

```bash
npm install @codemirror/view @codemirror/state @codemirror/lang-shell @codemirror/theme-one-dark
```

El bundle estará tree-shakeado por Vite — solo se incluye lo importado.

---

### 3.2 `src/components/ScriptEditor.tsx` (nuevo)

Modal con editor CodeMirror para crear/editar scripts.

**Props:**
```typescript
interface ScriptEditorProps {
  scriptId?: string;       // undefined = nuevo script
  onClose: () => void;
  onSave: (script: Script) => void;
}
```

**Contenido del modal:**
- Input: nombre del script (`.sh` se agrega automáticamente)
- Editor CodeMirror con `lang-shell` y tema oscuro
- Toggle checkbox "Executable (chmod +x)"
- Botón "Test" → llama a `POST /api/scripts/:id/test`, muestra output inline
- Botones: Guardar / Cancelar

**Template por defecto para scripts nuevos:**
```bash
#!/usr/bin/env bash
# Script creado desde LogiTux
set -euo pipefail

echo "Hello from LogiTux script!"
```

---

### 3.3 `src/components/ScriptManager.tsx` (nuevo)

Sección de gestión de scripts. Se puede montar dentro de `SettingsPanel.tsx` como una tab adicional.

**Layout:**
```
[ + Nuevo Script ]

  volume.sh            ✓ ejecutable    [Editar] [Eliminar]
  brightness.sh        ✓ ejecutable    [Editar] [Eliminar]
  mi-script.sh         ✗ no ejecutable [Editar] [Eliminar]
```

---

### 3.4 `src/components/ActionPicker.tsx` — Actualizar case `RunScript`

Reemplazar el render actual de `RunScript` (que solo muestra texto) con un picker funcional:

```tsx
case 'RunScript':
  return (
    <div className="runscript-picker">
      <label>Script</label>
      <select value={action.scriptId} onChange={...}>
        <option value="">-- Seleccionar script --</option>
        {scripts.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <button onClick={() => openScriptEditor(action.scriptId)}>✏️ Editar</button>

      <label>Macro Key</label>
      <select value={action.macroKey} onChange={...}>
        {macroKeys.available.map(k => (
          <option key={k} value={k} disabled={macroKeys.inUse[k] && macroKeys.inUse[k] !== currentCidKey}>
            {k} {macroKeys.inUse[k] && macroKeys.inUse[k] !== currentCidKey ? '(en uso)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
```

Cargar la lista de scripts y macro keys vía `useEffect` al montar el componente `ActionPicker`.

---

### 3.5 `src/components/MousePreview.tsx` — Ícono >_ para RunScript

En el overlay de cada botón SVG, agregar un ícono cuando la acción activa es `RunScript`:

```tsx
{config.simpleAction.type === 'RunScript' && (
  <span className="button-badge script-badge" title="Script">⚡</span>
)}
```

---

## Fase 4 — Integración con WebSocket (Tier 2 — opcional)

El servidor ya tiene WebSocket (`/ws`). Agregar un evento `script-output`:

```typescript
// server/index.ts:
wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    const { type, scriptId } = JSON.parse(msg.toString());
    if (type === 'run-script') {
      const child = spawnScript(scriptId);
      child.stdout.on('data', (d) => ws.send(JSON.stringify({ type: 'script-output', data: d.toString() })));
      child.on('close', (code) => ws.send(JSON.stringify({ type: 'script-done', exitCode: code })));
    }
  });
});
```

---

## Orden de Implementación

1. `server/types.ts` → reconciliar RunScript (scriptId)
2. `src/types.ts` → sincronizar
3. `server/services/scriptRunner.ts` → whitelist dinámica
4. `server/services/profileApplier.ts` → usar scriptId
5. `server/services/keyListener.ts` → macro key pool dinámico
6. `server/routes/scripts.ts` → agregar `/test` endpoint
7. `npm install @codemirror/*`
8. `src/components/ScriptEditor.tsx` → nuevo
9. `src/components/ScriptManager.tsx` → nuevo
10. `src/components/ActionPicker.tsx` → actualizar RunScript case
11. `src/components/MousePreview.tsx` → badge ⚡
12. `src/hooks/useApi.ts` → agregar hooks para scripts y macro keys
13. Tests para scriptRunner y keyListener con los nuevos cambios

## Estimación de Complejidad

- Fase 1 (backend): Mediana — refactor sin cambios de arquitectura
- Fase 2 (API): Baja
- Fase 3 (frontend): Alta — componentes nuevos + CodeMirror integration
- Fase 4 (WebSocket): Media — opcional, no bloquea el flujo principal
