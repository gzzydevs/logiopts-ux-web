# Spec 07 — Implementation Plan

## Fase 1: Fixes Críticos

### 1.1 FIX-01 — Simple Action divert mode

**Problema**: `divertKeys[cid] = 1` para simple actions, pero las rules usan `MouseGesture` que requiere mode `2`.

**Cambio**: Una línea en `src/context/AppContext.tsx`:
```diff
- divertKeys[btn.cid] = 1;
+ divertKeys[btn.cid] = 2;
```

**Por qué funciona**: Solaar `MouseGesture: ButtonName` (sin dirección) se dispara cuando un botón en mode `2` se clickea sin mover el mouse. Es el mecanismo estándar de Solaar para "button click diverted".

**Test**: Configurar Back Button → KeyPress `Control_L + c` → Simple Action → Apply → verificar que Ctrl+C se envía al hacer click.

---

### 1.2 FIX-02 — Tab activa determina gestureMode al aplicar

**Archivo**: `src/components/ActionConfigurator.tsx`

**Cambio**: El toggle entre Simple/Gestures ya actualize `gestureMode` via `onConfigChange`. Verificar que:
1. Cambiar tab actualiza `config.gestureMode` inmediatamente
2. Si el usuario tiene Simple Action configurada, cambia a Gestures, no pone nada, y aplica → debería haber fallback al detectar gestures vacíos, o warning visual

**Implementación**:
- Al cambiar tab, llamar `onConfigChange({...config, gestureMode: newValue})`
- Si la tab de Gestures está vacía (todos `None`), mostrar un warning inline: "No gestures configured — simple action will be used"
- Si ambas tabs tienen config, mostrar "●" indicator en la tab inactiva

---

### 1.3 FIX-03 — Indicator visual de config en tabs

**Archivo**: `src/components/ActionConfigurator.tsx` + `ActionConfigurator.css`

```tsx
const hasSimpleAction = config.simpleAction.type !== 'None';
const hasGestures = Object.values(config.gestures).some(a => a.type !== 'None');

// En el tab button:
<button className={`tab ${!config.gestureMode ? 'active' : ''}`}>
  Simple Action {hasSimpleAction && config.gestureMode && <span className="tab-dot">●</span>}
</button>
<button className={`tab ${config.gestureMode ? 'active' : ''}`}>
  Mouse Gestures {hasGestures && !config.gestureMode && <span className="tab-dot">●</span>}
</button>
```

CSS:
```css
.tab-dot {
  color: var(--accent);
  margin-left: 4px;
  font-size: 0.7em;
}
```

---

## Fase 2: ComboBuilder Improvements

### 2.1 CB-01 — Preservar orden de selección de modifiers

**Problema actual**: `selectedMods` es un `Set<string>`. `buildCombo()` itera `MODIFIERS` constant → siempre Ctrl, Shift, Alt, Super sin importar orden de clicks.

**Cambio**: Usar `string[]` en vez de `Set<string>`. Toggle agrega al final o remueve.

```tsx
// Antes:
const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());

function toggleMod(keysym: string) {
    setSelectedMods(prev => {
        const next = new Set(prev);
        if (next.has(keysym)) next.delete(keysym);
        else next.add(keysym);
        return next;
    });
}

function buildCombo(): string[] {
    const parts: string[] = [];
    for (const mod of MODIFIERS) {
        if (selectedMods.has(mod.keysym)) parts.push(mod.keysym);
    }
    if (selectedKey) parts.push(selectedKey);
    return parts;
}

// Después:
const [selectedMods, setSelectedMods] = useState<string[]>([]);

function toggleMod(keysym: string) {
    setSelectedMods(prev => {
        if (prev.includes(keysym)) return prev.filter(k => k !== keysym);
        return [...prev, keysym];
    });
}

function buildCombo(): string[] {
    const parts = [...selectedMods];
    if (selectedKey) parts.push(selectedKey);
    return parts;
}
```

También actualizar el `useEffect` de sync para preservar orden del input:
```tsx
useEffect(() => {
    if (!open) return;
    const mods: string[] = [];
    let mainKey: string | null = null;
    for (const k of currentKeys) {
        if (MODIFIERS.some(m => m.keysym === k)) {
            if (!mods.includes(k)) mods.push(k);
        } else if (k) {
            mainKey = k;
        }
    }
    setSelectedMods(mods);
    setSelectedKey(mainKey);
}, [open, currentKeys]);
```

Y actualizar el check en el botón de modifier:
```tsx
className={`combo-mod-btn ${selectedMods.includes(mod.keysym) ? 'active' : ''}`}
```

---

### 2.2 CB-02 — Botón Clear

Agregar en la sección de preview:
```tsx
<div className="combo-preview">
    <span className={combo.length > 0 ? 'combo-active' : 'combo-empty'}>
        {preview}
    </span>
    {combo.length > 0 && (
        <button className="combo-clear-btn" onClick={() => {
            setSelectedMods([]);
            setSelectedKey(null);
        }}>
            ✕
        </button>
    )}
</div>
```

---

### 2.3 CB-03 — Keyboard shortcuts (Enter/Escape)

```tsx
useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') { onCancel(); }
        if (e.key === 'Enter' && combo.length > 0) { handleConfirm(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
}, [open, combo]);
```

---

### 2.4 CB-04 — Grupo Punctuation

Agregar a `KEY_GROUPS`:
```typescript
{
    title: 'Punctuation',
    keys: [
        { keysym: 'semicolon', label: ';' },
        { keysym: 'colon', label: ':' },
        { keysym: 'comma', label: ',' },
        { keysym: 'period', label: '.' },
        { keysym: 'slash', label: '/' },
        { keysym: 'backslash', label: '\\' },
        { keysym: 'bracketleft', label: '[' },
        { keysym: 'bracketright', label: ']' },
        { keysym: 'braceleft', label: '{' },
        { keysym: 'braceright', label: '}' },
        { keysym: 'parenleft', label: '(' },
        { keysym: 'parenright', label: ')' },
        { keysym: 'apostrophe', label: "'" },
        { keysym: 'quotedbl', label: '"' },
        { keysym: 'grave', label: '`' },
        { keysym: 'minus', label: '-' },
        { keysym: 'equal', label: '=' },
        { keysym: 'plus', label: '+' },
        { keysym: 'underscore', label: '_' },
        { keysym: 'at', label: '@' },
        { keysym: 'numbersign', label: '#' },
        { keysym: 'exclam', label: '!' },
        { keysym: 'question', label: '?' },
        { keysym: 'ampersand', label: '&' },
        { keysym: 'bar', label: '|' },
        { keysym: 'asciitilde', label: '~' },
        { keysym: 'asciicircum', label: '^' },
    ],
},
```

---

### 2.5 CB-05 — Grupo Numpad

```typescript
{
    title: 'Numpad',
    keys: [
        ...Array.from({ length: 10 }, (_, i) => ({
            keysym: `KP_${i}`,
            label: `KP ${i}`,
        })),
        { keysym: 'KP_Enter', label: 'KP Enter' },
        { keysym: 'KP_Add', label: 'KP +' },
        { keysym: 'KP_Subtract', label: 'KP -' },
        { keysym: 'KP_Multiply', label: 'KP *' },
        { keysym: 'KP_Divide', label: 'KP /' },
        { keysym: 'KP_Decimal', label: 'KP .' },
    ],
},
```

---

### 2.6 CB-06 — Search/Filter

```tsx
const [searchQuery, setSearchQuery] = useState('');

// Filter keys across all groups
const filteredGroups = searchQuery.trim()
    ? KEY_GROUPS.map(g => ({
        ...g,
        keys: g.keys.filter(k =>
            k.keysym.toLowerCase().includes(searchQuery.toLowerCase()) ||
            k.label.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    })).filter(g => g.keys.length > 0)
    : [KEY_GROUPS[activeGroup]];

// Render search input above tabs
<input
    type="text"
    className="combo-search"
    placeholder="Search keys…"
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
/>
```

---

### 2.7 CB-07 — Presets

Agregar una tab "Presets" virtual:
```typescript
const PRESETS = [
    { label: 'Copy', keys: ['Control_L', 'c'] },
    { label: 'Paste', keys: ['Control_L', 'v'] },
    { label: 'Cut', keys: ['Control_L', 'x'] },
    { label: 'Undo', keys: ['Control_L', 'z'] },
    { label: 'Redo', keys: ['Control_L', 'Shift_L', 'z'] },
    { label: 'Select All', keys: ['Control_L', 'a'] },
    { label: 'New Tab', keys: ['Control_L', 't'] },
    { label: 'Close Tab', keys: ['Control_L', 'w'] },
    { label: 'Restore Tab', keys: ['Control_L', 'Shift_L', 't'] },
    { label: 'Play/Pause', keys: ['XF86_AudioPlay'] },
    { label: 'Vol+', keys: ['XF86_AudioRaiseVolume'] },
    { label: 'Vol-', keys: ['XF86_AudioLowerVolume'] },
    { label: 'Mute', keys: ['XF86_AudioMute'] },
];
```

Clicking a preset sets the combo directly and auto-confirms.

---

## Fase 3: Polish (P2)

### 3.1 PL-01 — Recently Used Keys (localStorage)

Clave: `logitux:recent-keys`. Guardar último combo completo (max 8). Mostrar como row horizontal arriba de tabs.

### 3.2 PL-02 — Live YAML Preview

Renderizar debajo del preview la representación YAML que generaría el parser:
```yaml
- KeyPress:
  - [Control_L, Shift_L, t]
  - click
```

### 3.3 PL-03/04 — Theme + A11y

- CSS variables para light/dark
- Arrow key navigation en el grid
- `role="grid"`, `aria-selected`, focus-visible styles

---

## Orden de Ejecución Sugerido

1. **FIX-01** (5 min) — Simple action fix
2. **FIX-02 + FIX-03** (30 min) — Tab resolution + indicators
3. **CB-01** (15 min) — Key order preservation
4. **CB-02 + CB-03** (15 min) — Clear + keyboard shortcuts
5. **CB-04 + CB-05** (10 min) — New key groups
6. **CB-06** (20 min) — Search filter
7. **CB-07** (20 min) — Presets
8. **PL-01..04** (según prioridad)

**Estimación total Fase 1+2**: ~2 horas
