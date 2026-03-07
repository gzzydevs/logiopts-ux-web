# SPEC-13 — Multi-Mouse Support — Implementation Plan

## Status: completed

## Checklist

- [x] **Spec created** — `specs/13-multi-mouse-support/spec.md`

### Backend

- [x] `server/types.ts`
  - Add `connected?: boolean` to `KnownDevice`
  - Add `connectedDeviceIds: string[]` to `BootstrapData`

- [x] `server/state/memory-store.ts`
  - Add `connectedDeviceIds: Set<string>` & `activeDeviceId: string | null` to `MemoryState`
  - Export `setConnectedDevices(ids: string[]): void`
  - Export `isDeviceConnected(id: string): boolean`
  - Export `setActiveDevice(id: string | null): void` / `getActiveDeviceId(): string | null`
  - Update `bootstrap()` to decorate devices with `connected` flag and return `connectedDeviceIds`

- [x] `server/index.ts`
  - Call `setConnectedDevices([unitId])` after Solaar auto-detect
  - Restore `lastActiveDeviceId` preference on bootstrap
  - Add `GET /api/active-device`
  - Add `POST /api/active-device`

- [x] `server/mock/data.ts`
  - Add `MOCK_DEVICE_2` (MX Anywhere 3S, disconnected) with profiles

- [x] `server/mock/routes.ts`
  - Return both devices in bootstrap (`connectedDeviceIds` = only device 1)
  - Add in-memory `mockActiveDeviceId` state
  - Add `GET /api/active-device` and `POST /api/active-device`

### Frontend

- [x] `src/types.ts`
  - Add `connected?: boolean` to `KnownDevice`
  - Add `connectedDeviceIds: string[]` to `BootstrapData`

- [x] `src/context/AppContext.tsx`
  - Add `devices: KnownDevice[]` state & `activeDeviceId: string | null` state
  - Add `selectDevice(id: string)` callback
  - Update `bootstrap()` to set all devices with connected flags, pick active device,
    filter profiles to active device
  - Update `detectDevice()` to refresh devices with connected flags
  - Keep `allProfilesRef` for SSE watcher lookups across all devices
  - Export `devices`, `activeDeviceId`, `selectDevice` from context

- [x] `src/components/Topbar.tsx`
  - Consume `devices`, `activeDeviceId`, `selectDevice` from context
  - Show "not detected" badge when `device.connected === false`
  - Show `⇅` switch button only when `devices.length > 1`
  - Portal-rendered device-picker dropdown (fixed-position, closes on outside click)

- [x] `src/components/Topbar.css`
  - `.device-disconnected-badge` — red pill badge
  - `.device-switch-btn` — icon-only round button
  - `.device-picker-dropdown` — floating dropdown card
  - `.device-picker-item` — device row (name + status)

### Tests & quality

- [x] All existing tests still pass (`npm test` — 163 tests)
- [x] TypeScript compiles without errors (`npx tsc --noEmit`)
- [x] Mock mode (`MOCK_MODE=true`) shows two devices (one connected, one not detected)
