# Persistencia SQLite + Estado en Memoria

## Tasks

- [x] Explorar codebase existente (types, routes, services, solaar parser)
- [/] Escribir implementation_plan.md con diseño del módulo de persistencia
- [ ] Revisar plan con el usuario
- [ ] Instalar `better-sqlite3` + tipos
- [ ] Crear `server/db/schema.sql`
- [ ] Crear `server/db/index.ts` (inicialización + singleton)
- [ ] Crear repositorios: `device.repo.ts`, `profile.repo.ts`, `config.repo.ts`, `script.repo.ts`
- [ ] Crear `server/state/memory-store.ts` (cache JSON/YAML con rollback)
- [ ] Migrar [routes/profiles.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/profiles.ts) de archivo → SQLite
- [ ] Migrar [routes/config.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/config.ts) para usar persistencia + memory-store
- [ ] Migrar [routes/scripts.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/routes/scripts.ts) para CRUD completo
- [ ] Crear endpoint `GET /api/bootstrap`
- [ ] Agregar endpoints faltantes (PUT config, PUT scripts, etc.)
- [ ] Integrar memory-store con el flujo de Solaar (parser → persist → apply)
- [ ] Tests unitarios para repositorios
- [ ] Tests de integración para endpoints
- [ ] Verificación: roundtrip DB → memory-store → Solaar YAML
