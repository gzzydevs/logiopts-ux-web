import { Tray, Menu, nativeImage, type BrowserWindow, app } from 'electron';
import path from 'node:path';
import { startSolaarMinimized, type SolaarElectronStatus } from './solaar-manager.js';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): (state: SolaarElectronStatus) => void {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('LogiTux');

  const updateMenu = (state: SolaarElectronStatus) => {
    updateTrayMenu(mainWindow, state);
  };

  updateMenu({ running: false, installed: false });

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return updateMenu;
}

function updateTrayMenu(mainWindow: BrowserWindow, state: SolaarElectronStatus): void {
  const solaarLabel = state.running ? '✓ activo' : '✗ inactivo';

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Abrir LogiTux',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: `Solaar: ${solaarLabel}`,
      enabled: false,
    },
  ];

  if (!state.running && state.installed) {
    template.push({
      label: 'Iniciar Solaar',
      click: () => startSolaarMinimized(),
    });
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  );

  const menu = Menu.buildFromTemplate(template);
  tray?.setContextMenu(menu);
}
