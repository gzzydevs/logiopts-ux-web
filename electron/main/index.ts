/**
 * Electron main process — entry point.
 *
 * Starts the Express server, creates the BrowserWindow,
 * sets up the system tray, and polls Solaar status.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { startServer, stopServer } from './server-runner.js';
import { createTray, updateTrayMenu } from './tray.js';
import { startSolaarMinimized, startSolaarPolling, stopSolaarPolling } from './solaar-manager.js';
import { setAutostart, isAutostartEnabled } from './autostart.js';

let mainWindow: BrowserWindow | null = null;
const SERVER_PORT = 3001;

app.whenReady().then(async () => {
  // 1. Start the Express server as a child process
  await startServer();

  // 2. Create the main browser window
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
  createTray(mainWindow);

  // 4. Start Solaar status polling
  startSolaarPolling(mainWindow, updateTrayMenu);

  // 5. Start minimized if launched with --hidden (autostart)
  if (process.argv.includes('--hidden')) {
    mainWindow.hide();
  }
});

// Prevent quitting when all windows are closed (tray keeps running)
app.on('window-all-closed', () => { /* no-op: tray keeps the app alive */ });

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  stopSolaarPolling();
  stopServer();
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('start-solaar', () => startSolaarMinimized());

ipcMain.handle('set-autostart', (_event, enabled: boolean) => {
  setAutostart(enabled);
  return enabled;
});

ipcMain.handle('get-autostart', () => isAutostartEnabled());
