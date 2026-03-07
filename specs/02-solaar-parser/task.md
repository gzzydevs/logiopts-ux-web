# Solaar Parser Module — Task Tracker

## Planning
- [x] Research existing codebase ([types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts), [configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts), [profileApplier.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/profileApplier.ts), routes)
- [x] Analyze reference Solaar YAML format from [aplicar_solaar_macros.sh](file:///home/gzzy/Desktop/workspace/logitux-web/aplicar_solaar_macros.sh)
- [x] Identify gap between current [configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts) and real Solaar format
- [/] Write SDD / implementation plan
- [ ] Get user approval on plan

## Implementation
- [ ] Configure Jest + ts-jest for the project
- [ ] Create `server/solaar/schema.ts` — types, constants, Macro type
- [ ] Create `server/solaar/validator.ts` — validation logic
- [ ] Create `server/solaar/parser.ts` — JSON⇄YAML conversion
- [ ] Create `server/solaar/index.ts` — public API exports
- [ ] Refactor [server/services/configGenerator.ts](file:///home/gzzy/Desktop/workspace/logitux-web/server/services/configGenerator.ts) to use new module

## Testing
- [ ] Create `server/solaar/__tests__/json-to-yaml.test.ts`
- [ ] Create `server/solaar/__tests__/yaml-to-json.test.ts`
- [ ] Create `server/solaar/__tests__/roundtrip.test.ts`
- [ ] Run all tests, verify >90% coverage
