# Spec 06 — Preferences & Profile Configuration

## Contexto

LogiTux permite configurar botones de mouse Logitech y almacenar perfiles en SQLite.
Actualmente el sistema tiene soporte básico de perfiles (CRUD, default flag, `windowClasses`),
pero carece de preferencias persistentes y de una gestión coherente entre el perfil **activo**
(el que el mouse tiene cargado) y el perfil **default** (guardado en DB).

## Conceptos Clave

### Perfil Default
- Guardado en la tabla `profiles` con `isDefault = 1`
- Es el perfil que se carga cuando no hay match de ventana
- Persiste en DB

### Perfil Activo
- Representa lo que el mouse **tiene cargado en este momento**
- Se mantiene en memoria (server-side) y se expone al frontend
- Puede coincidir o no con el Default
- Al entrar a la app, se muestra el perfil activo (no necesariamente el default)

### Flujo con Window Watcher

```
Usuario tiene perfil activo "Gaming" cargado en el mouse
  → Abre Firefox
    → Window Watcher detecta cambio de ventana
    → Busca profile con windowClass "firefox"
      ├─ MATCH: Tiene profile "Firefox" → aplica "Firefox" → activo = "Firefox"
      │   → Sale de Firefox, entra a Terminal
      │   → Busca profile con windowClass "terminal"
      │     ├─ MATCH: aplica ese profile
      │     └─ NO MATCH: → aplica perfil ACTIVO original ("Gaming")
      └─ NO MATCH: → mantiene perfil ACTIVO ("Gaming"), no hace nada
```

**Importante**: El fallback es al perfil **activo** (el que el usuario eligió/tenía), NO al default. El default es solo el perfil que se carga en el bootstrap inicial si no hay info de qué estaba activo.

---

## Problemas Actuales

### P1: El botón de guardar no persiste los buttons del perfil

`saveConfig()` escribe la config YAML/JSON en la tabla `configs`, pero **no actualiza** la columna `buttons` de la tabla `profiles`. Los cambios se pierden al recargar.

**Archivos**: `src/context/AppContext.tsx`, `server/routes/config.ts`

### P2: No hay persistencia de preferencias de usuario

- `windowWatcherActive` es un `useState(false)` que se resetea al recargar
- No se guarda qué perfil estaba seleccionado
- No hay tabla de preferencias en DB

**Archivos**: `server/db/schema.sql`, `server/state/memory-store.ts`

### P3: No se distingue perfil activo de perfil seleccionado en UI

- `activeProfileId` en el frontend es "cuál tab/selector estoy mirando"
- No hay concepto de "cuál tiene el mouse cargado ahora"
- `currentAppliedProfileId` existe como variable suelta en `server/index.ts`, no se expone al frontend

### P4: Window Watcher fallback al profile "Default" por nombre

- En `server/index.ts`, al no encontrar match de ventana, busca el profile por `name === 'default'`
- Debería hacer fallback al perfil **activo**, no al default
- Si el usuario renombra el profile default, el fallback se rompe

### P5: No hay notificación server → frontend de cambios de perfil

- Cuando el Window Watcher cambia de perfil, el frontend no se entera
- El usuario ve un perfil en la UI pero el mouse tiene otro cargado
- No hay SSE, WebSocket, ni polling para sincronizar

### P6: Bootstrap siempre selecciona el primer perfil

- `profiles[0]` en el frontend, sin importar cuál estaba activo antes
- Sin persistencia de `lastActiveProfileId`

---

## Features a Implementar

### F1 — Tabla de Preferencias
Crear tabla `preferences` (key/value) para almacenar configuración de usuario.

### F2 — Save Button Completo
El botón Save debe actualizar tanto `configs` como `profiles.buttons`.

### F3 — Perfil Activo como Concepto Formal
- Server: exponer `activeProfileId` vía API (`GET /api/active-profile`)
- Server: actualizar `activeProfileId` al aplicar cualquier perfil
- Frontend: distinguir "perfil que estoy editando" de "perfil cargado en el mouse"
- UI: badge "Active" en el perfil que el mouse tiene cargado

### F4 — Persistencia de Preferencias
- Guardar `windowWatcherEnabled`, `lastActiveProfileId`, `locale` en tabla `preferences`
- Restaurar al arrancar el server y al cargar el frontend

### F5 — Window Watcher con Fallback Inteligente
- Fallback al perfil activo (no al default por nombre)
- Activar automáticamente al arrancar si la preferencia lo indica

### F6 — Sincronización Server → Frontend (SSE)
- SSE endpoint (`GET /api/events`) para push de cambios
- Eventos: `profile-switched`, `config-applied`, `device-changed`
- Frontend se suscribe al montar AppContext

### F7 — Restaurar Último Perfil al Bootstrap
- Leer `lastActiveProfileId` de preferences
- Si existe y es válido, seleccionar ese perfil en el frontend

---

## Criterios de Aceptación

- [ ] Save guarda buttons en la tabla `profiles` y config en la tabla `configs`
- [ ] Al recargar la página, se restaura el último perfil seleccionado
- [ ] Window Watcher respeta su toggle al reiniciar el server
- [ ] Al cambiar de ventana sin profile match, se vuelve al perfil **activo**, no al default
- [ ] UI muestra badge "Active" en el perfil cargado en el mouse
- [ ] Si el Window Watcher cambia de perfil, la UI refleja el cambio en tiempo real
- [ ] Múltiples perfiles se pueden crear, editar, aplicar y eliminar
