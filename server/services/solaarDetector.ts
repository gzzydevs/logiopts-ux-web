import { execFile } from 'node:child_process';
import { constants } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { SolaarStatus, SolaarInstallType } from '../types.js';
import { existsSync } from 'node:fs';

const HOME = homedir();
const FLATPAK_CONFIG = resolve(HOME, '.var/app/io.github.pwr_solaar.solaar/config/solaar');
const SYSTEM_CONFIG = resolve(HOME, '.config/solaar');
const FLATPAK_APP_ID = 'io.github.pwr_solaar.solaar';

import { execSync } from 'node:child_process';

const IS_FLATPAK = existsSync('/.flatpak-info');
const IS_TOOLBOX = existsSync('/run/.containerenv');

const HAS_FLATPAK_SPAWN = existsSync('/usr/bin/flatpak-spawn');
const HAS_DISTROBOX_EXEC = existsSync('/usr/bin/distrobox-host-exec');

// We simply try flatpak-spawn if we know we are in a sandbox or we detected the binary
export const USE_HOST_SPAWN = IS_FLATPAK || IS_TOOLBOX || HAS_FLATPAK_SPAWN || HAS_DISTROBOX_EXEC;
export const HOST_SPAWN_BIN = HAS_DISTROBOX_EXEC ? 'distrobox-host-exec' : 'flatpak-spawn';

/** Run a command on the host (escaping VS Code Flatpak / Distrobox sandbox if needed) */
export function hostExec(command: string, args: string[] = [], timeout = 10000): Promise<string> {
  return new Promise((res, rej) => {
    const bin = USE_HOST_SPAWN ? 'flatpak-spawn' : command;
    const finalArgs = USE_HOST_SPAWN ? ['--host', command, ...args] : args;

    execFile(bin, finalArgs, { timeout }, (err, stdout, stderr) => {
      // Don't log normal failures (like 'which solaar' failing) as it clutters logs
      if (err && err.code !== 1) return rej(new Error(stderr?.trim() || err.message));
      res(stdout.trim());
    });
  });
}

/** Run a shell command string on the host */
export function hostShell(cmd: string, timeout = 10000): Promise<string> {
  return new Promise((res, rej) => {
    // If not in a container, run bash directly
    const bin = USE_HOST_SPAWN ? 'flatpak-spawn' : 'bash';
    const finalArgs = USE_HOST_SPAWN ? ['--host', 'bash', '-c', cmd] : ['-c', cmd];

    execFile(bin, finalArgs, { timeout }, (err, stdout, stderr) => {
      console.log(`[hostShell Debug] cmd: ${cmd}`);
      console.log(`[hostShell Debug] err:`, err ? err.code : 'none');
      console.log(`[hostShell Debug] stderr:`, stderr?.trim());
      console.log(`[hostShell Debug] stdout:`, stdout?.trim());

      if (err && err.code !== 1) return rej(new Error(stderr?.trim() || err.message));
      res(stdout.trim());
    });
  });
}

async function dirExists(path: string): Promise<boolean> {
  try {
    // Try reading from the host filesystem
    const out = await hostShell(`test -d "${path}" && echo yes || echo no`);
    return out === 'yes';
  } catch {
    return false;
  }
}

/** Detect whether Solaar is installed and where */
export async function detectSolaar(): Promise<SolaarStatus> {
  console.log('[SolaarDetector] Starting detection...');
  console.log(`[SolaarDetector] Env: USE_HOST_SPAWN=${USE_HOST_SPAWN}`);

  const result: SolaarStatus = {
    installed: false,
    installType: 'none',
    running: false,
    configDir: '',
    version: '',
  };

  // Check Flatpak install
  try {
    const cmd = `flatpak info ${FLATPAK_APP_ID}`; // Removed | head -1 and 2>/dev/null to debug
    console.log(`[SolaarDetector] Running: ${cmd}`);
    const out = await hostShell(cmd);
    console.log(`[SolaarDetector] Output: "${out}"`);
    if (out) {
      result.installed = true;
      result.installType = 'flatpak';
      result.configDir = FLATPAK_CONFIG;
      // Extract version
      const ver = await hostShell(`flatpak info ${FLATPAK_APP_ID} 2>/dev/null | grep -i version | head -1 | awk '{print $2}'`).catch(() => '');
      result.version = ver;
    }
  } catch (err) {
    console.error(`[SolaarDetector] Flatpak check error:`, err);
  }

  // Check system install if no Flatpak
  if (!result.installed) {
    try {
      console.log(`[SolaarDetector] Running: which solaar`);
      const out = await hostShell('which solaar 2>/dev/null');
      console.log(`[SolaarDetector] Output: "${out}"`);
      if (out) {
        result.installed = true;
        result.installType = 'system';
        result.configDir = SYSTEM_CONFIG;
        const ver = await hostShell('solaar --version 2>&1 | head -1').catch(() => '');
        result.version = ver;
      }
    } catch (err) {
      console.error(`[SolaarDetector] System check error:`, err);
    }
  }

  // Check if running
  try {
    const pid = await hostShell('pgrep -f "python.*solaar" 2>/dev/null | head -1');
    result.running = !!pid && pid !== '';
  } catch {
    result.running = false;
  }

  return result;
}

/** Get the `solaar show` command depending on install type */
export function getSolaarShowCommand(installType: SolaarInstallType): string {
  return installType === 'flatpak'
    ? `flatpak run ${FLATPAK_APP_ID} show`
    : 'solaar show';
}

/** Get the command to launch Solaar in background */
export function getSolaarLaunchCommand(installType: SolaarInstallType): string {
  return installType === 'flatpak'
    ? `flatpak run ${FLATPAK_APP_ID} --window=hide &`
    : 'solaar --window=hide &';
}

/** Kill Solaar process */
export async function killSolaar(): Promise<void> {
  try {
    // 'python.*solaar' matches the real Solaar process without matching
    // any shell script whose path happens to contain 'solaar'
    await hostShell('pkill -f "python.*solaar" 2>/dev/null; sleep 1');
  } catch { /* already dead */ }
}

/** Launch Solaar */
export async function launchSolaar(installType: SolaarInstallType): Promise<void> {
  const cmd = getSolaarLaunchCommand(installType);
  try {
    // Launch in background, don't wait
    await hostShell(`nohup ${cmd} > /dev/null 2>&1`);
  } catch { /* may time out, that's ok for background launch */ }
}

/** Read a file from the host filesystem */
export async function hostReadFile(path: string): Promise<string> {
  return hostShell(`cat "${path}" 2>/dev/null`);
}

/** Write content to a file on the host filesystem */
export async function hostWriteFile(path: string, content: string): Promise<void> {
  // Use heredoc to write multi-line content safely
  const escaped = content.replace(/'/g, "'\\''");
  await hostShell(`cat > "${path}" << 'SOLAAR_EOF'\n${content}\nSOLAAR_EOF`);
}

/** Parse `solaar show` output into device info */
export function parseSolaarShow(output: string): ParsedDevice[] {
  const devices: ParsedDevice[] = [];
  // Match only top-level device entries which are indented with exactly 2 spaces
  // (e.g. "  1: LIFT VERTICAL ERGONOMIC MOUSE").
  // Using /\n {2}\d+:\s+/ instead of /\n\s+\d+:\s+/ avoids matching deeply-
  // indented button/feature entries (9+ spaces) which have the same numeric
  // prefix pattern but belong inside the device block.
  const deviceBlocks = output.split(/\n  \d+:\s+/).slice(1);
  const deviceHeaders = output.match(/\n  (\d+):\s+(.+)/g) || [];

  for (let i = 0; i < deviceHeaders.length; i++) {
    const header = deviceHeaders[i].trim();
    const block = deviceBlocks[i] || '';
    const nameMatch = header.match(/\d+:\s+(.+)/);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    const fullBlock = header + '\n' + block;

    // Skip offline devices
    if (fullBlock.includes('device is offline')) continue;

    const dev: ParsedDevice = {
      name,
      unitId: '',
      protocol: '',
      battery: -1,
      dpi: 2400,
      buttons: [],
      divertKeys: {},
    };

    // Extract Unit ID
    const unitMatch = fullBlock.match(/Unit ID:\s*(\w+)/);
    if (unitMatch) dev.unitId = unitMatch[1];

    // Extract protocol
    const protoMatch = fullBlock.match(/Protocol\s*:\s*HID\+\+\s*([\d.]+)/);
    if (protoMatch) dev.protocol = protoMatch[1];

    // Extract battery
    const batMatch = fullBlock.match(/Battery:\s*(\d+)%/);
    if (batMatch) dev.battery = parseInt(batMatch[1], 10);

    // Extract DPI
    const dpiMatch = fullBlock.match(/Sensitivity \(DPI\)\s*:\s*(\d+)/);
    if (dpiMatch) dev.dpi = parseInt(dpiMatch[1], 10);

    // Extract divert-keys
    const divertMatch = fullBlock.match(/Key\/Button Diversion\s*:\s*\{([^}]+)\}/);
    if (divertMatch) {
      const pairs = divertMatch[1].split(',');
      for (const pair of pairs) {
        const [key, val] = pair.split(':').map(s => s.trim());
        if (key && val) {
          dev.divertKeys[key] = val === 'Mouse Gestures' ? 2 : val === 'Diverted' ? 1 : 0;
        }
      }
    }

    // Extract reprogrammable keys
    const keySection = fullBlock.match(/Has \d+ reprogrammable keys:([\s\S]*?)(?=\n\s+Battery:|$)/);
    if (keySection) {
      const keyBlocks = keySection[1].split(/\n\s+\d+:\s+/).slice(1);
      const keyHeaders = keySection[1].match(/\n\s+(\d+):\s+(.+)/g) || [];
      for (let j = 0; j < keyHeaders.length; j++) {
        const kh = keyHeaders[j].trim();
        const kb = keyBlocks[j] || '';
        const knMatch = kh.match(/\d+:\s+(.+?)\s*,\s*default:/);
        if (!knMatch) continue;
        const buttonName = knMatch[1].trim();
        // Skip the internal virtual gesture button — it's not a physical key
        if (buttonName === 'Virtual Gesture Button') continue;
        const flags = kb.toLowerCase();
        dev.buttons.push({
          name: buttonName,
          divertable: flags.includes('divertable'),
          rawXy: flags.includes('raw_xy'),
          reprogrammable: flags.includes('reprogrammable'),
        });
      }
    }

    devices.push(dev);
  }

  return devices;
}

export interface ParsedDevice {
  name: string;
  unitId: string;
  protocol: string;
  battery: number;
  dpi: number;
  buttons: ParsedButton[];
  divertKeys: Record<string, number>;
}

export interface ParsedButton {
  name: string;
  divertable: boolean;
  rawXy: boolean;
  reprogrammable: boolean;
}
