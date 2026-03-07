import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Solaar status
  onSolaarStatus: (
    cb: (status: { running: boolean; installed: boolean }) => void,
  ) => {
    ipcRenderer.on('solaar-status', (_event, status) => cb(status));
  },
  startSolaar: () => ipcRenderer.invoke('start-solaar'),

  // Autostart
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('set-autostart', enabled),
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke('get-autostart'),

  // Platform flag
  isElectron: true,
});
