/**
 * Electron main process — System tray icon and context menu.
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'node:path';
import type { SolaarState } from './solaar-manager.js';

let tray: Tray | null = null;
let cachedWindow: BrowserWindow | null = null;

export function createTray(mainWindow: BrowserWindow): void {
  cachedWindow = mainWindow;

  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('LogiTux');

  updateTrayMenu({ running: false, installed: false });

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

export function updateTrayMenu(state: SolaarState): void {
  if (!tray || !cachedWindow) return;

  const win = cachedWindow;

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Abrir LogiTux',
      click: () => { win.show(); win.focus(); },
    },
    { type: 'separator' },
    {
      label: `Solaar: ${state.running ? '✓ activo' : '✗ inactivo'}`,
      enabled: false,
    },
  ];

  if (!state.running && state.installed) {
    template.push({
      label: 'Iniciar Solaar',
      click: async () => {
        const { startSolaarMinimized } = await import('./solaar-manager.js');
        startSolaarMinimized();
      },
    });
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.quit();
      },
    },
  );

  const menu = Menu.buildFromTemplate(template);
  tray!.setContextMenu(menu);
}
