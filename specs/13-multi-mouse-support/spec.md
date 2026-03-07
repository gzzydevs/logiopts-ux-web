# SPEC-13 — Multi-Mouse Support

## Overview

LogiTux can now manage multiple Logitech mice simultaneously. The database already
stores profiles per device (`profiles.deviceId` FK), so the persistence layer
requires no migration. What's new is:

1. **Connected-device tracking** — the server marks which devices are currently
   visible to Solaar at startup/scan time, versus devices that are stored in the
   database from a previous session.
2. **Active-device selection** — the user can switch between known devices in the
   UI; the selection is persisted as a preference (`lastActiveDeviceId`).
3. **Profile filtering** — the profile list and all profile operations are scoped
   to the active device.
4. **"Not detected" indicator** — devices stored in the database but not currently
   plugged in (or not seen by Solaar) are shown with a "not detected" badge so the
   user knows the hardware is offline.

## Motivation

Solaar already manages multiple Logitech devices natively. Users with two mice
(e.g. a desk MX Master 3 and a portable MX Anywhere 3S) want to configure macros
for both without losing the configuration of the one that is currently unplugged.

## User stories

- **US-01** As a user with two Logitech mice, I can see both in the UI and switch
  between them with a single click, even when one is disconnected.
- **US-02** When a device is not currently plugged in, the UI clearly labels it
  "not detected" so I know it is offline, but I can still browse and edit its
  profiles.
- **US-03** The selected device persists across browser reloads (stored as
  `lastActiveDeviceId` preference).
- **US-04** Profiles created or edited are always tied to the currently active
  device; switching devices swaps the profile list automatically.
- **US-05** In mock/cloud mode, a second device (disconnected) is pre-loaded so
  the multi-mouse UI can be evaluated without real hardware.

## Non-goals (out of scope for this spec)

- Applying Solaar configuration to a device that is currently disconnected.
- Window-watcher profile auto-switching for the non-active device (the watcher
  already operates device-agnostically at the Solaar level).
- Managing more than the first device in the legacy bootstrap auto-detect flow
  (detecting all Solaar devices during first-boot will be a follow-up).

## Technical design

### Backend

| Component | Change |
|-----------|--------|
| `server/types.ts` | `KnownDevice.connected?: boolean`; `BootstrapData.connectedDeviceIds: string[]` |
| `server/state/memory-store.ts` | `connectedDeviceIds: Set<string>` + `activeDeviceId` in memory state; `setConnectedDevices()`, `getActiveDeviceId()`, `setActiveDevice()` |
| `server/index.ts` | After each Solaar scan `setConnectedDevices([...detected unitIds])`; add `GET/POST /api/active-device` |
| `server/mock/data.ts` | Second mock device (`MOCK_DEVICE_2`) marked as disconnected |
| `server/mock/routes.ts` | Return both devices in bootstrap with `connectedDeviceIds`; support `/api/active-device` |

### Frontend

| Component | Change |
|-----------|--------|
| `src/types.ts` | Mirror server type additions |
| `src/context/AppContext.tsx` | `devices: KnownDevice[]`, `activeDeviceId`, `selectDevice(id)` added; `profiles` is filtered to the active device; `allProfilesRef` for cross-device SSE lookups |
| `src/components/Topbar.tsx` | "not detected" badge when `!device.connected`; `⇅` button appears when `devices.length > 1`; portal-rendered device-picker dropdown |
| `src/components/Topbar.css` | New CSS: `.device-disconnected-badge`, `.device-switch-btn`, `.device-picker-dropdown`, `.device-picker-item` |

## API endpoints

### Existing (unchanged)
- `GET /api/bootstrap` — now includes `connectedDeviceIds: string[]` in the
  response; each device in `devices[]` has `connected: boolean` set.

### New
- `GET /api/active-device` → `{ ok, data: { deviceId: string | null } }`
- `POST /api/active-device` `{ deviceId }` → `{ ok, data: { deviceId } }`  
  Also saves `lastActiveDeviceId` to preferences.

## UI/UX notes

- The device section of the Topbar remains compact. No new screens are added.
- When only one device is known, the switcher button is hidden — the Topbar looks
  identical to the pre-SPEC-13 layout except for a possible "not detected" badge.
- When multiple devices are known, a small `⇅` icon appears to the right of the
  device name. Clicking it opens an inline dropdown (rendered via portal to avoid
  stacking-context clipping) listing all devices with their battery level or
  "not detected" status.
