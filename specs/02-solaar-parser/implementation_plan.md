# SDD — Módulo `server/solaar/` — Parser JSON ⇄ YAML (Solaar)

## Resumen

Crear un módulo independiente `server/solaar/` que permita convertir de forma **determinística, reversible y validable** entre la representación JSON interna del sistema (tipos existentes en [types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts)) y el formato YAML multi-documento que Solaar espera en `rules.yaml`.

El módulo actual en [configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts) ya tiene lógica de generación/parseo de `rules.yaml`, pero:
- Genera una estructura con wrapper `Rule: [...]` que **no coincide** con el formato real de Solaar
- Está acoplado al service layer
- No tiene tests

El formato real de Solaar (según el script [aplicar_solaar_macros.sh](file:///home/gzzy/Desktop/workspace/logitux-web/aplicar_solaar_macros.sh)) usa **multi-documento YAML** (`%YAML 1.3` + documentos separados por `---` / `...`), donde cada documento es una lista tipo:

```yaml
%YAML 1.3
---
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
---
- MouseGesture: [Forward Button, Mouse Up]
- KeyPress: XF86_AudioPlay
...
```

> [!IMPORTANT]
> **Decisión clave**: El formato actual en [configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts) produce YAML con wrapper `Rule: [...]` que probablemente Solaar no interpreta correctamente. Este módulo lo reemplaza con el formato real multi-documento.

---

## Proposed Changes

### Configuración de Jest

Se debe agregar Jest + ts-jest al proyecto, dado que actualmente no tiene ningún test runner configurado.

#### [MODIFY] [package.json](file:///home/gzzy/Desktop/workspace/logitux-web/package.json)
- Agregar `devDependencies`: `jest`, `ts-jest`, `@types/jest`
- Agregar script `"test": "jest"` y `"test:coverage": "jest --coverage"`

#### [NEW] [jest.config.ts](file:///home/gzzy/Desktop/workspace/logitux-web/jest.config.ts)
- Configurar `ts-jest` con `preset: 'ts-jest'`
- `testMatch`: `['**/server/solaar/__tests__/**/*.test.ts']`
- `moduleNameMapper` para resolver imports con `.js` extension (ESM compatibility)

---

### Módulo `server/solaar/`

#### [NEW] [schema.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/schema.ts)

Define los tipos de datos internos del parser (independientes pero compatibles con [types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts)):

```typescript
/** Macro: what a button/gesture does */
export type Macro =
  | { type: 'KeyPress'; keys: string[] }       // X11 keysyms
  | { type: 'MouseClick'; button: 'left' | 'middle' | 'right'; action: 'click' | number }
  | { type: 'MouseScroll'; horizontal: number; vertical: number }
  | { type: 'Execute'; command: string[] }
  | { type: 'None' };

export type GestureDirection = 'click' | 'up' | 'down' | 'left' | 'right';

/** A button with its actions per gesture direction */
export interface ButtonMapping {
  id: string;                          // Solaar button name: "Forward Button", "DPI Switch"
  actions: Partial<Record<GestureDirection, Macro>>;
}

/** A profile groups buttons for a device */
export interface ProfileConfig {
  deviceId: string;
  profile: string;
  buttons: ButtonMapping[];
}

/** Internal representation of a single Solaar rule (one YAML document) */
export interface SolaarRuleDoc {
  buttonName: string;
  direction: GestureDirection;
  action: Macro;
  comment?: string;
}

/** Map from GestureDirection to Solaar's YAML direction suffix */
export const SOLAAR_DIRECTION_MAP: Record<GestureDirection, string | null> = {
  click: null,
  up: 'Mouse Up',
  down: 'Mouse Down',
  left: 'Mouse Left',
  right: 'Mouse Right',
};

/** Reverse map from Solaar direction string to our direction */
export const REVERSE_DIRECTION_MAP: Record<string, GestureDirection> = {
  'Mouse Up': 'up',
  'Mouse Down': 'down',
  'Mouse Left': 'left',
  'Mouse Right': 'right',
};

/** Known valid X11 keysym prefixes for validation */
export const VALID_MODIFIER_KEYS = [
  'Control_L', 'Control_R', 'Shift_L', 'Shift_R',
  'Alt_L', 'Alt_R', 'Super_L', 'Super_R', 'Meta_L', 'Meta_R',
];

export const VALID_SPECIAL_KEYS = [
  'XF86_AudioPlay', 'XF86_AudioPause', 'XF86_AudioStop',
  'XF86_AudioRaiseVolume', 'XF86_AudioLowerVolume', 'XF86_AudioMute',
  'XF86_AudioNext', 'XF86_AudioPrev',
  'Tab', 'Return', 'Escape', 'space', 'BackSpace', 'Delete',
  'Home', 'End', 'Page_Up', 'Page_Down',
  'Up', 'Down', 'Left', 'Right',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
];
```

#### [NEW] [validator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/validator.ts)

Validación estructurada con errores claros:

```typescript
export interface ValidationError {
  path: string;         // e.g. "buttons[0].actions.click"
  code: string;         // e.g. "INVALID_KEYSYM", "EMPTY_MACRO"
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

Funciones:
- `validateProfileConfig(config: ProfileConfig): ValidationResult` — valida JSON de entrada
- `validateMacro(macro: Macro, path: string): ValidationError[]` — valida un macro individual
- `validateKeysym(key: string): boolean` — valida keysyms X11
- `validateSolaarYaml(yamlStr: string): ValidationResult` — valida YAML crudo

#### [NEW] [parser.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/parser.ts)

Lógica central de conversión:

**`jsonToSolaarYaml(config: ProfileConfig): string`**
1. Itera `config.buttons` → para cada botón + dirección con acción no-`None`
2. Genera un documento YAML con el formato:
   ```yaml
   ---
   - MouseGesture: [ButtonName]           # para click
   - MouseGesture: [ButtonName, Mouse Up]  # para dirección
   - KeyPress: [key1, key2]               # o KeyPress: single_key
   ...
   ```
3. Agrega comentarios `# === BUTTON NAME ===` por grupo de botón
4. Concatena todo con `%YAML 1.3\n` como header

**`solaarYamlToJson(yamlStr: string): ProfileConfig`**
1. Separa documentos por `---` / `...`
2. Parsea cada doc con `js-yaml`
3. Extrae condición (`MouseGesture`) y acción (`KeyPress`, `MouseClick`, etc.)
4. Agrupa por nombre de botón → reconstruye `ButtonMapping[]`
5. Normaliza datos faltantes (botones sin dirección = solo click)

**`normalizeConfig(config: ProfileConfig): ProfileConfig`**
- Ordena botones y acciones de forma determinística (para roundtrip)
- Rellena acciones faltantes con `{ type: 'None' }`

#### [NEW] [index.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/solaar/index.ts)

Public API:

```typescript
export { jsonToSolaarYaml, solaarYamlToJson, normalizeConfig } from './parser.js';
export { validateProfileConfig, validateSolaarYaml } from './validator.js';
export type { ProfileConfig, ButtonMapping, Macro, SolaarRuleDoc } from './schema.js';
```

---

### Refactor del código existente

#### [MODIFY] [configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts)

- [generateRulesYaml()](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts#75-114): Refactorizar para delegar al nuevo `jsonToSolaarYaml()` del módulo `solaar/`, convirtiendo `ButtonConfig[]` → `ProfileConfig` internamente
- [parseRulesYaml()](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts#175-243): Refactorizar para delegar a `solaarYamlToJson()` del nuevo módulo
- Se mantiene la API pública para no romper [config.ts](file:///home/gzzy/Desktop/workspace/logitux-web/vite.config.ts) ni [profileApplier.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/profileApplier.ts)

> [!WARNING]
> El refactor de [configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts) cambia el formato de salida del YAML. El formato actual con `Rule: [...]` probablemente no funciona con Solaar real. El nuevo formato multi-documento sí.

---

## Formato YAML — Referencia detallada

Basado en el script de referencia, el formato real de Solaar `rules.yaml`:

```yaml
%YAML 1.3
---
# === FORWARD BUTTON ===
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
---
- MouseGesture: [Forward Button, Mouse Up]
- KeyPress: XF86_AudioPlay
...
```

| Elemento | Formato |
|---|---|
| Header | `%YAML 1.3` |
| Doc start | `---` |
| Doc end | `...` |
| Condition | `- MouseGesture: [ButtonName]` o `- MouseGesture: [ButtonName, Direction]` |
| KeyPress (multi) | `- KeyPress: [Key1, Key2, ...]` |
| KeyPress (single) | `- KeyPress: KeyName` |
| MouseClick | `- MouseClick: [button, action]` |
| Comment | `# text` antes de condición |

> [!NOTE]
> Cada regla es un **documento YAML separado** (entre `---` y `...`), no un item de una lista. Esto es diferente a como lo genera el [configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts) actual.

---

## Verification Plan

### Automated Tests

Se crearán 3 suites de test Jest:

#### 1. `server/solaar/__tests__/json-to-yaml.test.ts`
- Conversión simple (1 botón, 1 acción click)
- Conversión con gestos (click + up + down + left + right)
- Múltiples botones
- Múltiples dispositivos
- KeyPress single key vs array
- MouseClick action
- Botón sin acciones → no genera documento
- Perfil vacío → solo header
- Formato de indentación y delimitadores `---` / `...`

#### 2. `server/solaar/__tests__/yaml-to-json.test.ts`
- Parse de YAML simple
- Parse con gestos
- Múltiples documentos
- YAML malformado → error estructurado
- YAML con campos desconocidos → ignorados
- Normalización de datos faltantes
- Validación de keysyms inválidos

#### 3. `server/solaar/__tests__/roundtrip.test.ts`
- `JSON → YAML → JSON` produce el mismo resultado normalizado
- Múltiples botones con diferentes tipos de acción
- Edge case: orden inconsistente normalizado en ambas direcciones

**Comando para ejecutar:**
```bash
cd /home/gzzy/Desktop/workspace/logitux-web
npx jest --coverage --verbose
```

Objetivo: cobertura > 90% en archivos dentro de `server/solaar/`.
