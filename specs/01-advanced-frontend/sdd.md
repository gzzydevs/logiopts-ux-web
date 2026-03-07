# Software Design Document (SDD): LogiTux Macros Frontend

## Objective
Provide a robust, aesthetic, and localized web interface for configuring Logitech mouse macros on Bazzite OS via Solaar rules.

## Architecture
- **Frontend Framework**: React 19 + Vite.
- **Backend Framework**: Express.js (pre-existing setup). 
- **State Management**: React Context or Zustand for global UI state (Profiles, Devices, Mocks Mode, Window Watcher).
- **Styling**: Vanilla CSS, aiming for a modern, glassmorphism-inspired aesthetic matching premium configuration utilities (like Logitech Options+).
- **Internationalization (i18n)**: Basic JSON-based dictionary approach or `react-i18next` for English and Spanish.

## Core Features & Requirements
### 1. Mock Mode & Solaar Polling
- **Feature**: Prevent the frontend from failing if Solaar is not running. 
- **Implementation**: A "Mocks" toggle in settings. When ON, all API calls to Express resolve immediately with dummy data. When OFF, the app will show a loading screen while polling `/api/solaar/status` every 2 seconds until a 200 OK is received.

### 2. Device Selection & Preview
- **Feature**: Visualize the mouse and switch between multiple mice.
- **Implementation**: Mock data representing `[ { id: 'mx-master-3', name: 'MX Master 3', image: '/assets/mx3.png' } ]`. The UI will render `MousePreview`, mapping SVG/HTML "nodes" (buttons) over specific coordinates of the device image.

### 3. Application Profiles
- **Feature**: Separate macro configurations for different applications.
- **Implementation**: Topbar rendering icons (`Global`, `Chrome`, `VSCode`). Selecting a profile changes the active macro set in state.

### 4. Macro Configuration
- **Feature**: 5 distinct gestures per configurable button (Normal Click, Click + Up, Down, Left, Right).
- **Implementation**: When a node on the `MousePreview` is clicked, an `ActionConfigurator` overlay or side-panel appears. It displays 5 slots. Each slot can be assigned:
  - System Action (e.g., Media Play)
  - Bash Script (e.g., `play_sound.sh`)
  - Keyboard Shortcut (e.g., `Ctrl+C`)

### 5. Services and Integration (Phase 1 Stubbing)
- **Profile Database**: SQLite (Scheduled for Phase 2). *Implementation note: Add `// TODO: connect to sqlite db` in the API wrapper.*
- **Solaar YAML parser**: (Scheduled for Phase 2). *Implementation note: Add `// TODO: sync JSON spec to Solaar rules.yaml` on save actions.*

## Component Structure
1. `App` (Main View router / State provider)
2. `LoadingOverlay` (Displays until Solaar is ready)
3. `MainLayout`
   - `Topbar` (Profiles & Devices)
   - `SettingsSidebar` (Window Watcher & Mock toggles)
   - `ConfigurationWorkspace`
     - `MousePreview` (The interactive hardware visualizer)
     - `ActionConfigurator` (The drawer/popover for the 5 macros)

## Design Aesthetics
- Vibrant yet clean layout (dark mode preferred defaults).
- Smooth CSS transitions for hover states on mouse nodes.
- Responsive popovers for action selections.
