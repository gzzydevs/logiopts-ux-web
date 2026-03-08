/**
 * Electron preload script — safe IPC bridge.
 *
 * Exposes a limited set of APIs to the renderer process
 * via contextBridge.exposeInMainWorld, keeping nodeIntegration disabled.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Solaar status — main → renderer push
  onSolaarStatus: (cb: (status: { running: boolean; installed: boolean }) => void) => {
    ipcRenderer.on('solaar-status', (_event, status) => cb(status));
  },
  startSolaar: () => ipcRenderer.invoke('start-solaar'),

  // Autostart
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('set-autostart', enabled),
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke('get-autostart'),

  // Utility flag
  isElectron: true as const,
});
