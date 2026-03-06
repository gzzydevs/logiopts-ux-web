# Frontend ↔ Backend Integration — Status as of March 5, 2026

## Already Done (do not touch)

- [x] `src/types.ts` — all correct types: `KnownDevice`, `ButtonConfig`, `SolaarAction`, `Profile`, `Script`, `BootstrapData`, `Toast`
- [x] `src/main.tsx` — already wraps in `<AppProvider>`
- [x] `src/context/AppContext.tsx` — fully rewritten. Uses correct types, has `bootstrap()`, `detectDevice()`, `updateButton()`, `saveConfig()`, `applyCurrentConfig()`, toast management, `dirty` tracking
- [x] `src/hooks/useApi.ts` — has `fetchBootstrap()`, `saveConfigToDB()`, `applyConfig()`, `fetchDevice()`, `fetchSystemActions()` — all working
- [x] `src/components/Topbar.tsx` — rewritten. Uses `useAppContext()`, Save + Apply buttons with loading states, Detect Device button, profile selector
- [x] `src/components/Toast.tsx` — exists with `ToastContainer` component
- [x] `src/components/MousePreview.tsx` — uses `useAppContext()`, renders buttons dynamically from `device.buttons`, calls `ActionConfigurator`
- [x] `src/components/ActionConfigurator.tsx` — uses `SolaarAction`, `useAppContext()`, `ActionPicker` for gesture mode and simple mode
- [x] `src/components/ActionPicker.tsx` — functional, supports all `SolaarAction` types
- [x] `src/components/SettingsPanel.tsx` — clean, no mocks, uses `useAppContext()`

---

## THE ONLY PENDING TASK

### [ ] Rewrite `src/App.tsx`

The current `App.tsx` is the OLD version. It keeps everything in its own local state (`useState`) and **never touches `AppContext`**. This means the `AppProvider` in `main.tsx`, the `Topbar`, the `MousePreview`, etc. never get connected.

See [implementation_plan.md](./implementation_plan.md) for the exact implementation.

---

## Final Verification

- [ ] `cd /home/gzzy/Desktop/workspace/logitux-web && npx jest` — all 148 tests must pass without touching any server files
- [ ] `npm run dev` — open the app in the browser and verify it loads, shows the device, and Apply works
