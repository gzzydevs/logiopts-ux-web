# Frontend ↔ Backend Integration

## Phase 1 — Rewrite AppContext
- [ ] Rewrite [src/context/AppContext.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/context/AppContext.tsx) to use correct types from [src/types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts)
- [ ] Add [Script](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts#137-146) type to [src/types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts) (missing from frontend)
- [ ] Add [BootstrapData](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts#149-155) type to [src/types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts)
- [ ] Add bootstrap/detect/save/apply functions to context
- [ ] Add toast state management

## Phase 2 — Connect Components
- [ ] Rewrite [App.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/App.tsx) to call [bootstrap()](file:///home/gzzy/Desktop/workspace/logitux-web/server/state/memory-store.ts#170-196) on mount
- [ ] Rewrite [Topbar.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/Topbar.tsx) to use [KnownDevice](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#3-15), add Save + Apply buttons
- [ ] Rewrite [MousePreview.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/MousePreview.tsx) to use `device.buttons` dynamically
- [ ] Rewrite [ActionConfigurator.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/ActionConfigurator.tsx) to use [SolaarAction](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#28-35) types via [ActionPicker](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/ActionPicker.tsx#12-224)
- [ ] Update [SettingsPanel.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/SettingsPanel.tsx) to remove mocksMode

## Phase 3 — Toast Component
- [ ] Create `Toast.tsx` + `Toast.css`

## Phase 4 — Update useApi.ts
- [ ] Add `fetchBootstrap()` function
- [ ] Add `saveConfig()` function (PUT)
- [ ] Ensure API calls match actual backend routes

## Phase 5 — Verification
- [ ] Run existing tests (`npx jest`) — all 148+ must pass
- [ ] Visual browser test of the full flow
