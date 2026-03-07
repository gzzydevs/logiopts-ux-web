# Task List: LogiTux Macros Frontend

## Phase 1: Planning and Setup
- [x] Create Software Design Document (SDD).
- [x] Create Implementation Plan.
- [ ] Setup i18n (English/Spanish).

## Phase 2: Mock Services & State
- [ ] Implement Mock API Service for Devices (mice).
- [ ] Implement Mock API Service for Profiles (apps).
- [ ] Implement Mock API Service for Solaar status (polling).
- [ ] Setup State Management (selected device, selected profile, Solaar status).

## Phase 3: Core UI Layout
- [ ] Topbar: Device selector and App Profile selector.
- [ ] Sidebar/Settings: "Window Watcher" toggle, "Mocks Mode" toggle.
- [ ] Main Area: Loading screen (while waiting for Solaar) or Mouse Preview.

## Phase 4: Mouse Preview & Macros Configuration
- [ ] `MousePreview` component: Display generic 2D mouse or loaded image. Clickable button zones.
- [ ] `MacroConfigurer` component: UI to configure up to 5 macros per button (Normal, Up, Down, Left, Right).
- [ ] `ActionSelector`: Choose between System Action, Bash Script, Keyboard Shortcut.

## Phase 5: Polish & Integration
- [ ] Ensure Bazzite/flatpak compatibility considerations are documented for the future parser/db sync.
- [ ] Verify i18n functionality.
- [ ] Final UI/UX review against reference images.
