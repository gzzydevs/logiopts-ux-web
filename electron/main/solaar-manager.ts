import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { BrowserWindow } from 'electron';

export interface SolaarElectronStatus {
  installed: boolean;
  running: boolean;
}

export function isSolaarInstalled(): boolean {
  // Check system binary paths
  const paths = ['/usr/bin/solaar', '/usr/local/bin/solaar'];
  if (paths.some((p) => existsSync(p))) return true;

  // Check Flatpak
  try {
    execSync('flatpak info io.github.pwr_solaar.solaar', {
      stdio: 'pipe',
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

export function isSolaarRunning(): boolean {
  try {
    execSync('pgrep -x solaar', { stdio: 'pipe', timeout: 2000 });
    return true;
  } catch {
    // pgrep returns exit code 1 when no process found
  }
  try {
    execSync('pgrep -f "python.*solaar"', {
      stdio: 'pipe',
      shell: '/bin/sh',
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

export function startSolaarMinimized(): void {
  const isFlatpak = !existsSync('/usr/bin/solaar') && !existsSync('/usr/local/bin/solaar');
  const cmd = isFlatpak
    ? 'flatpak run io.github.pwr_solaar.solaar'
    : 'solaar';

  spawn(cmd, ['--window-close-action=hide-to-tray'], {
    shell: true,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startSolaarPolling(
  mainWindow: BrowserWindow,
  updateTrayMenu: (state: SolaarElectronStatus) => void,
): void {
  const poll = () => {
    const running = isSolaarRunning();
    const installed = isSolaarInstalled();
    const status: SolaarElectronStatus = { running, installed };
    mainWindow.webContents.send('solaar-status', status);
    updateTrayMenu(status);
  };

  poll(); // Immediate first poll
  pollInterval = setInterval(poll, 10_000);
}

export function stopSolaarPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
