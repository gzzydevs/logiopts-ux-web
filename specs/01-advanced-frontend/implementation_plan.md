# Frontend Implementation Plan: Solaar Macros UI

We want to implement a frontend application that allows users to configure the buttons on their Logitech mouse through a visual, intuitive interface. This configuration uses Solaar rules under the hood.

The frontend uses React and Vite, served alongside the existing Express backend. 

## Proposed Changes

### Configuration Data
- Create a mock data structure and context to emulate endpoints for Devices, App Profiles, and Macros.
- Store macro configs temporarily in memory per device and profile. Provide "TODO: replace with database integration" for later phases.

### Components
We will use Vite and pure React with CSS to build the layout, taking inspiration from the provided screenshots for the dynamic styling.

---
#### [NEW] src/components/Topbar.tsx
Displays a list of app profiles (e.g., Global, Chrome, Photoshop, VSCode). Clicking on one changes the active profile context. Includes an 'Add Profile' button.

#### [NEW] src/components/SettingsPanel.tsx
A sidebar or persistent panel for global settings:
- "Mocks Mode" toggle (to simulate devices and connections).
- "Window Watcher" toggle (to watch active foreground apps, turning off/on the existing watcher service via API mock).

#### [NEW] src/components/MousePreview.tsx
A canvas or image wrapper that visualizes the currently selected device. It will place clickable "nodes" on top of the image to represent configurable buttons. If an image isn't provided by the mock, use a generic SVG mouse.

#### [NEW] src/components/ActionConfigurator.tsx
A component that opens when a mouse node is clicked.
It allows configuring 5 actions per button:
1. Normal Click
2. Click + Up
3. Click + Down
4. Click + Left
5. Click + Right

For each action slot, the user can select an Action Type: "System Action", "Bash Command", or "Keyboard Shortcut".
- System Action: pre-defined list (Copy, Paste, Media Play, etc.).
- Bash Command: text input for the script filename (e.g., inside `scripts/`).
- Keyboard Shortcut: input that captures keystrokes.

#### [NEW] src/components/LoadingOverlay.tsx
A screen shown initially that mimics polling Solaar every 2 seconds. In Mock mode, it bypasses or fakes a 2-second delay and then reveals the UI.

#### [NEW] src/i18n/index.ts
Setup basic i18n support.
#### [NEW] src/i18n/locales/en.json
#### [NEW] src/i18n/locales/es.json
Include translations for generic texts "Loading...", "Mocks Mode", "Window Watcher Active", "Add Profile", "System Action", etc.

## Verification Plan

### Automated Tests
*Currently no automated tests exist in this baseline. We will add Jest or React Testing Library in a later phase if required.*

### Manual Verification
1. Run `npm run dev` to start the concurrent Vite and Express servers.
2. Open the browser to the application URL.
3. Observe the initial `LoadingOverlay` wait for "Solaar" resolution.
4. Toggle "Mocks Mode" to ensure the app behaves without relying on real local APIs.
5. In the Topbar, select a different profile icon and verify the active state changes.
6. Click on a node in the `MousePreview`. Ensure the `ActionConfigurator` opens.
7. Attempt to assign different action types to all 5 gesture slots of a button. Verify the UI updates correctly.
8. Switch language between EN and ES to ensure i18n basic strings change.
