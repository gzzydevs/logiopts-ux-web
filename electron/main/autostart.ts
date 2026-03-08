/**
 * Electron main process — XDG autostart management.
 *
 * Creates / removes ~/.config/autostart/logitux.desktop
 * so the app can start automatically when the user logs in.
 */

import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { app } from 'electron';

const AUTOSTART_DIR = join(os.homedir(), '.config', 'autostart');
const AUTOSTART_FILE = join(AUTOSTART_DIR, 'logitux.desktop');

export function setAutostart(enabled: boolean): void {
  if (enabled) {
    mkdirSync(AUTOSTART_DIR, { recursive: true });
    const content = `[Desktop Entry]
Type=Application
Name=LogiTux
Comment=Logitech mouse button configuration
Exec=${app.getPath('exe')} --hidden
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
`;
    writeFileSync(AUTOSTART_FILE, content, 'utf-8');
  } else {
    if (existsSync(AUTOSTART_FILE)) {
      unlinkSync(AUTOSTART_FILE);
    }
  }
}

export function isAutostartEnabled(): boolean {
  return existsSync(AUTOSTART_FILE);
}
