# Task List: SPEC-11 Cloud Mock Mode

## Phase 1: Core Implementation
- [x] Crear `server/mock/data.ts` — seed data (MX Master 3, 3 perfiles, scripts)
- [x] Crear `server/mock/routes.ts` — Express router in-memory completo
- [x] Modificar `server/index.ts` — soporte `MOCK_MODE=true`
- [x] Agregar `dev:cloud` y `dev:cloud:server` a `package.json`

## Phase 2: Documentación
- [x] Crear `specs/11-cloud-mock-mode/sdd.md` — spec detallado
- [x] Crear `specs/11-cloud-mock-mode/task.md` — este archivo
- [x] Crear `specs/11-cloud-mock-mode/implementation_plan.md`

## Phase 3: Validación
- [x] TypeScript typecheck (`npx tsc --noEmit`)
- [x] Tests existentes sin regresiones (`npm test`)
- [ ] Playwright smoke test screenshot (opcional, para agentes)
