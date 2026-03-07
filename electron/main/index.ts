import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { createTray } from './tray.js';
import { startServer, stopServer } from './server-runner.js';
import {
  startSolaarMinimized,
  startSolaarPolling,
  stopSolaarPolling,
} from './solaar-manager.js';
import { setAutostart, isAutostartEnabled } from './autostart.js';

const SERVER_PORT = 3001;
let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  // 1. Start the Express server as a child process
  await startServer();

  // 2. Create the main BrowserWindow
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Load the app from the local Express server
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  // Hide instead of close (minimize to tray)
  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // 3. Create system tray icon
  const updateTrayMenu = createTray(mainWindow);

  // 4. Start Solaar status polling
  startSolaarPolling(mainWindow, updateTrayMenu);

  // 5. If launched with --hidden (autostart), start minimized to tray
  if (process.argv.includes('--hidden')) {
    mainWindow.hide();
  }
});

// Prevent app from quitting when all windows are closed (stay in tray)
app.on('window-all-closed', () => {
  // Do nothing — keep the app running in the system tray
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  stopSolaarPolling();
  stopServer();
});

// IPC handlers
ipcMain.handle('start-solaar', () => startSolaarMinimized());
ipcMain.handle('set-autostart', (_event, enabled: boolean) => setAutostart(enabled));
ipcMain.handle('get-autostart', () => isAutostartEnabled());
