# SPEC-11: Cloud Mock Mode para Agentes de Copilot

## Resumen Ejecutivo

Este spec define un **modo de desarrollo de mocks** (`MOCK_MODE`) que permite a los agentes cloud de GitHub Copilot ejecutar y probar la UI completa de LogiTux sin necesidad de:
- Un ratón Logitech físico conectado
- Instalación de Solaar
- Privilegios de sistema especiales

El modo se activa con `npm run dev:cloud` y provee un dispositivo MX Master 3 pre-configurado con 3 perfiles, 9 botones y scripts de ejemplo.

---

## Motivación

Los agentes cloud de Copilot usan Playwright para probar la UI en entornos de CI (GitHub Actions runners). Estos entornos no tienen:
- Hardware Logitech
- Solaar instalado (`solaar show` falla)
- Display X11/Wayland para xdotool/keyListener

Sin mock mode, el servidor arranca pero `/api/bootstrap` devuelve `devices: []`, la UI queda en estado `no-device` y Playwright no puede probar las funcionalidades core (configurar botones, gestionar perfiles, editar layouts).

---

## Arquitectura del Mock Mode

### Diagrama de flujo

```
npm run dev:cloud
      │
      ├── MOCK_MODE=true tsx watch server/index.ts  (puerto 3001)
      │         │
      │         └── app.use('/api', mockRouter)   ← server/mock/routes.ts
      │                    │
      │                    ├── GET  /api/bootstrap  → MX Master 3 + 3 perfiles
      │                    ├── GET  /api/device      → datos del mock device
      │                    ├── CRUD /api/profiles    → in-memory (Map)
      │                    ├── CRUD /api/scripts     → in-memory (Map)
      │                    ├── POST /api/config      → no-op, devuelve OK
      │                    └── GET  /api/watcher/*   → simulado
      │
      └── vite                                       (puerto 5173)
                │
                └── proxy /api → localhost:3001
```

### Activación

```bash
# Modo mock (para agentes cloud / CI / Playwright)
npm run dev:cloud

# Modo real (requiere Solaar + hardware)
npm run dev
```

La flag `MOCK_MODE=true` es pasada como variable de entorno al servidor via `concurrently`.

---

## Datos Mock

### Dispositivo: MX Master 3 (Mock)

| Campo        | Valor                     |
|-------------|--------------------------|
| displayName | `MX Master 3 (Mock)`     |
| unitId      | `mock-unit-mx-master-3`  |
| pid         | `0x4082`                  |
| battery     | `75%`                     |
| svgId       | `mx-master-3`             |

#### Botones

| CID | Nombre        | Divertable |
|-----|--------------|-----------|
| 80  | Left Click   | ❌        |
| 81  | Right Click  | ❌        |
| 82  | Middle Click | ✅        |
| 83  | Back         | ✅        |
| 86  | Forward      | ✅        |
| 195 | Smart Shift  | ✅ (rawXy)|
| 215 | Scroll Left  | ✅        |
| 216 | Scroll Right | ✅        |
| 253 | DPI Switch   | ✅        |

### Perfiles Pre-configurados

| ID                      | Nombre  | DPI  | Window Classes       |
|------------------------|--------|------|---------------------|
| `mock-profile-default` | Default | 1000 | (ninguna)           |
| `mock-profile-gaming`  | Gaming  | 3200 | steam, Steam        |
| `mock-profile-media`   | Media   | 800  | vlc, spotify        |

**Default**: Middle Click → Ctrl+C  
**Gaming**: Middle Click → MouseClick(middle), Forward → Ctrl+Z  
**Media**: Smart Shift en modo gesture → Vol+/Vol-/Prev/Next

### Scripts

- `volume.sh` — control de volumen con pamixer
- `brightness.sh` — control de brillo
- `nightshift.sh` — filtro de luz azul con redshift

---

## Comportamiento del Servidor en Mock Mode

### Endpoints que devuelven datos pre-cargados (read)
- `GET /api/bootstrap` → device + 3 profiles + configs + scripts
- `GET /api/device` → MX Master 3 mock
- `GET /api/device/status` → `{ installed: true, installType: 'mock' }`
- `GET /api/device/system-actions` → acciones del sistema reales (del CID_MAP)
- `GET /api/config` → YAML vacío con comentario mock
- `GET /api/profiles` → lista in-memory
- `GET /api/scripts` → lista in-memory

### Endpoints con estado mutable (in-memory)
- `POST /api/profiles` → crea perfil in-memory
- `PUT /api/profiles/:id` → actualiza in-memory
- `DELETE /api/profiles/:id` → elimina in-memory
- `PUT /api/config` → actualiza botones del perfil in-memory
- `PUT /api/device/:id/layout` → actualiza posiciones de botones in-memory
- `POST /api/scripts` / `PUT` / `DELETE` → CRUD in-memory

### Endpoints no-op (simulados)
- `POST /api/config` → devuelve OK, no llama Solaar
- `POST /api/config/reset` → devuelve OK, no llama Solaar
- `POST /api/actions/:script` → devuelve OK con output simulado
- `POST /api/watcher/toggle` → flag in-memory, no inicia proceso real

### Servicios omitidos en mock mode
- `windowWatcher` → no se inicia (sin X11 en CI)
- `keyListener` → no se inicia (sin teclado físico)
- Diagnósticos de flatpak/distrobox → no se ejecutan

---

## Escenarios de Prueba con Playwright

### Estado inicial esperado

Al arrancar con `dev:cloud`, el agente debe ver:
1. La UI en estado `connected` (no loading, no error, no no-device)
2. Device name "MX Master 3 (Mock)" en el Topbar
3. Perfil activo: "Default"
4. MousePreview con los botones del dispositivo renderizados

### Flujos que se pueden probar

1. **Selección de perfil** — cambiar entre Default/Gaming/Media
2. **Configuración de botón** — click en un botón del MousePreview → ActionConfigurator
3. **Asignación de acción** — KeyPress, MouseClick, None, RunScript
4. **Guardar configuración** — botón Save (PUT /api/config)
5. **Aplicar configuración** — botón Apply (POST /api/config → no-op pero OK)
6. **Crear perfil** — modal "+" en Topbar → POST /api/profiles
7. **Eliminar perfil** — trash en Topbar → DELETE /api/profiles/:id
8. **Editor de layout** — modo edición drag&drop de botones
9. **Window Watcher toggle** — toggle en Settings

---

## Implementación

### Archivos creados

| Archivo                     | Propósito                              |
|---------------------------|----------------------------------------|
| `server/mock/data.ts`      | Datos mock: device, profiles, scripts  |
| `server/mock/routes.ts`    | Express router con estado in-memory    |

### Archivos modificados

| Archivo             | Cambio                                          |
|--------------------|-------------------------------------------------|
| `server/index.ts`  | `MOCK_MODE` check, imports mockRouter, wraps real endpoints |
| `package.json`     | Agrega `dev:cloud` y `dev:cloud:server`         |

---

## Consideraciones de Diseño

### Persistencia (o falta de ella)
En mock mode, todo el estado es in-memory. Cada restart del servidor reinicia los datos al estado inicial del seed. Esto es **intencional** para Playwright:
- Cada test suite comienza con un estado limpio y conocido
- No hay interferencia entre tests de distintas ramas/PRs

### Compatibilidad con el frontend
El mock router devuelve exactamente el mismo shape de datos que el server real:
```typescript
{ ok: true, data: <payload> }
// o en error:
{ ok: false, error: '<mensaje>' }
```
El frontend (`AppContext.tsx`, `useApi.ts`) no necesita ningún cambio.

### Extensibilidad
Para agregar más datos mock:
1. Editar `server/mock/data.ts` — agregar perfiles, scripts, botones
2. El mock router los usará automáticamente al siguiente restart

Para agregar nuevos endpoints mock, editar `server/mock/routes.ts` siguiendo el patrón existente.
