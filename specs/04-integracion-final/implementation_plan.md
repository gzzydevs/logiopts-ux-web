# Frontend ↔ Backend Integration

Connect the fully mock-based React frontend to the existing Express + SQLite backend, replacing incompatible types and enabling end-to-end configuration flow.

## Proposed Changes

### Frontend Types

#### [MODIFY] [types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts)

Add missing [Script](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts#137-146) and [BootstrapData](file:///home/gzzy/Desktop/workspace/logitux-web/server/types.ts#149-155) interfaces that the backend already exposes but the frontend doesn't have yet.

```diff
+export interface Script {
+  id: string;
+  name: string;
+  path: string;
+  content: string;
+  executable: boolean;
+  createdAt: string;
+  updatedAt: string;
+}
+
+export interface BootstrapData {
+  devices: KnownDevice[];
+  profiles: Profile[];
+  configs: { profileId: string; yamlConfig: string; appliedAt: string | null }[];
+  scripts: Script[];
+}
```

---

### API Layer

#### [MODIFY] [useApi.ts](file:///home/gzzy/Desktop/workspace/logitux-web/src/hooks/useApi.ts)

Add `fetchBootstrap()` and `saveConfigToDB()` (PUT) functions. The existing functions stay unchanged.

```diff
+export function fetchBootstrap(): Promise<BootstrapData> {
+  return api<BootstrapData>('/bootstrap');
+}
+
+export function saveConfigToDB(body: {
+  buttons: ButtonConfig[];
+  profileId: string;
+  deviceId: string;
+  profileName: string;
+}): Promise<{ yamlConfig: string; persisted: boolean }> {
+  return api<{ yamlConfig: string; persisted: boolean }>('/config', {
+    method: 'PUT',
+    body: JSON.stringify(body),
+  });
+}
```

---

### AppContext (Full Rewrite)

#### [MODIFY] [AppContext.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/context/AppContext.tsx)

**Complete rewrite.** Delete all local type definitions ([MacroSlot](file:///home/gzzy/Desktop/workspace/logitux-web/src/context/AppContext.tsx#3-7), [Device](file:///home/gzzy/Desktop/workspace/logitux-web/src/context/AppContext.tsx#24-29), old [ButtonConfig](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#54-60), old [Profile](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#69-79)). Import everything from [src/types.ts](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts). New state shape:

| State field | Type | Description |
|---|---|---|
| `device` | `KnownDevice \| null` | Detected device |
| `profiles` | `Profile[]` | From DB |
| `activeProfileId` | `string \| null` | Selected profile |
| `buttons` | `ButtonConfig[]` | Current profile's button configs |
| `scripts` | `Script[]` | For RunScript selector |
| `systemActions` | `SystemAction[]` | Quick actions |
| `appStatus` | `'loading' \| 'connected' \| 'error' \| 'no-device'` | Global status |
| `saveStatus` | `'idle' \| 'saving' \| 'saved' \| 'error'` | Save operation status |
| `applyStatus` | `'idle' \| 'applying' \| 'applied' \| 'error'` | Apply operation status |
| `toasts` | `Toast[]` | Notifications |

New functions exposed via context:
- [bootstrap()](file:///home/gzzy/Desktop/workspace/logitux-web/server/state/memory-store.ts#170-196) — calls `GET /api/bootstrap`, populates all state
- `detectDevice()` — calls `GET /api/device`, sets device
- [updateButton(cid, changes)](file:///home/gzzy/Desktop/workspace/logitux-web/src/context/AppContext.tsx#78-98) — updates button config in local state, marks dirty
- `saveConfig()` — calls `PUT /api/config` (persist without applying)
- [applyConfig()](file:///home/gzzy/Desktop/workspace/logitux-web/src/hooks/useApi.ts#61-70) — calls `POST /api/config` (full pipeline)
- `selectProfile(id)` — switches active profile, loads its buttons
- `addToast(toast)` / `removeToast(id)` — toast management

---

### Components

#### [MODIFY] [App.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/App.tsx)

Remove mock polling. Call [bootstrap()](file:///home/gzzy/Desktop/workspace/logitux-web/server/state/memory-store.ts#170-196) on mount. Show loading/error/no-device/connected states. Add `<ToastContainer />`.

#### [MODIFY] [Topbar.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/Topbar.tsx)

- Use `device: KnownDevice | null` instead of `devices: Device[]`
- Show `device.displayName` and battery status
- Replace device dropdown with "Detect Device" button (when null) or device name display
- Add **Save** and **Apply** buttons with loading states from context
- Profiles still selectable from `profiles[]`

#### [MODIFY] [MousePreview.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/MousePreview.tsx)

- Remove hardcoded `MOUSE_NODES` array
- Generate button nodes dynamically from `device.buttons: KnownButton[]`
- Use `cid` (number) as the active node identifier instead of string IDs
- Pass `cid` to new [ActionConfigurator](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/ActionConfigurator.tsx#23-124)

#### [MODIFY] [ActionConfigurator.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/ActionConfigurator.tsx)

**Full rewrite.** Replace the MacroSlot-based UI with [SolaarAction](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#28-35)-based UI:
- Use existing [ActionPicker](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/ActionPicker.tsx#12-224) component (already supports all [SolaarAction](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#28-35) types)
- Use existing [ButtonConfig](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#54-60) component (already has gesture mode toggle)
- Accept `cid: number` and `buttonName: string` as props
- Read [ButtonConfig](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#54-60) from context by CID, call [updateButton(cid, changes)](file:///home/gzzy/Desktop/workspace/logitux-web/src/context/AppContext.tsx#78-98) on edits
- Show gesture mode toggle (5 directions with ActionPicker) or simple mode (1 ActionPicker)

#### [MODIFY] [SettingsPanel.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/SettingsPanel.tsx)

Remove `mocksMode` toggle (no longer relevant). Keep language switcher and window watcher toggle.

#### [NEW] [Toast.tsx](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/Toast.tsx)

Toast notifications with auto-dismiss. Types: `success`, `error`, `warning`. Positioned fixed bottom-right. Uses CSS animations for slide-in/fade-out.

#### [NEW] [Toast.css](file:///home/gzzy/Desktop/workspace/logitux-web/src/components/Toast.css)

Styles for toast notifications — glassmorphism cards, type-specific accent colors, animations.

---

## Verification Plan

### Automated Tests

Run existing backend tests to ensure nothing regresses:

```bash
cd /home/gzzy/Desktop/workspace/logitux-web && npx jest --verbose
```

All 148+ tests must pass. We are **not** modifying any backend files, so these should pass unchanged.

### Browser Verification

After implementation, start the dev server and verify in the browser:

```bash
cd /home/gzzy/Desktop/workspace/logitux-web && npm run dev
```

1. Open the app — should show "Loading..." then transition to connected state or "no device" state
2. If no device: "Detect Device" button should be visible in topbar
3. If device found: mouse preview should show buttons from the device data
4. Click a button → ActionConfigurator opens with [SolaarAction](file:///home/gzzy/Desktop/workspace/logitux-web/src/types.ts#28-35) type dropdowns
5. Save and Apply buttons visible in topbar with correct loading states
6. Toast notifications appear on save/apply success or error

> [!NOTE]
> Since the backend depends on Solaar running on the host, full end-to-end testing with actual device detection will only work on the user's Bazzite system. The browser test will verify UI rendering and API call wiring. If no device is in DB from a previous session, the "no device" state should render correctly.
