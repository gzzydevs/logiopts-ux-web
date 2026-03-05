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

export let HOST_BIN: string | null = null;
try {
  execSync('distrobox-host-exec true', { stdio: 'ignore' });
  HOST_BIN = 'distrobox-host-exec';
} catch {
  try {
    execSync('flatpak-spawn --host true', { stdio: 'ignore' });
    HOST_BIN = 'flatpak-spawn';
  } catch {
    HOST_BIN = null;
  }
}

const USE_HOST_SPAWN = HOST_BIN !== null;

/** Run a command on the host (escaping VS Code Flatpak / Distrobox sandbox if needed) */
export function hostExec(command: string, args: string[] = [], timeout = 10000): Promise<string> {
  return new Promise((res, rej) => {
    const bin = HOST_BIN || command;
    const finalArgs = HOST_BIN === 'flatpak-spawn' ? ['--host', command, ...args]
      : HOST_BIN === 'distrobox-host-exec' ? [command, ...args]
        : args;

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
    const bin = HOST_BIN || 'bash';
    const finalArgs = HOST_BIN === 'flatpak-spawn' ? ['--host', 'bash', '-c', cmd]
      : HOST_BIN === 'distrobox-host-exec' ? ['bash', '-c', cmd]
        : ['-c', cmd];

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
    const pid = await hostShell('pgrep -f solaar 2>/dev/null | head -1');
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
    await hostShell('pkill -f solaar 2>/dev/null; sleep 1');
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

export interface ParsedButton {
  cid?: number;
  name: string;
  solaarName?: string;
  divertable: boolean;
  rawXy: boolean;
  reprogrammable: boolean;
  position?: string;
}

export interface ParsedDevice {
  name: string;
  unitId: string;
  protocol: string;
  battery: number;
  dpi: number;
  buttons: ParsedButton[];
  divertKeys: Record<string, 0 | 1 | 2>;
}

/** Parse `solaar show` output into device info */
export function parseSolaarShow(output: string): ParsedDevice[] {
  console.log('\n=== RAW SOLAAR SHOW OUTPUT ===\n' + output + '\n=============================\n');
  const devices: ParsedDevice[] = [];
  // Match numbered device entries (e.g., "  3: LIFT VERTICAL ERGONOMIC MOUSE")
  const deviceBlocks = output.split(/\n\s+\d+:\s+/).slice(1);
  const deviceHeaders = output.match(/\n\s+(\d+):\s+(.+)/g) || [];

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
    // The section starts with "Has X reprogrammable keys:" and ends at "Battery:" or EOF
    const keySectionMatch = fullBlock.match(/Has\s+\d+\s+reprogrammable keys:([\s\S]*?)(?=\n\s+Battery:|\n\s+===|$)/);
    if (keySectionMatch) {
      const keySection = keySectionMatch[1];

      // We look for lines like "         0: Left Button               , default: Left Click                  => Left Click"
      // and capture the block of text until the next button definition or end of section
      const buttonPattern = /\n\s+(\d+):\s+(.+?)\s*,\s*default:([\s\S]*?)(?=\n\s+\d+:\s+|$)/g;

      function guessPosition(name: string): string {
        const n = name.toLowerCase();
        if (n.includes('left')) return 'left';
        if (n.includes('right')) return 'right';
        if (n.includes('middle')) return 'middle';
        if (n.includes('forward')) return 'forward';
        if (n.includes('back')) return 'back';
        if (n.includes('dpi')) return 'dpiSwitch';
        if (n.includes('scroll') && n.includes('mode')) return 'scrollMode';
        return 'middle'; // default fallback
      }

      let btnMatch;
      while ((btnMatch = buttonPattern.exec('\n' + keySection)) !== null) {
        const cid = parseInt(btnMatch[1], 10);
        let buttonName = btnMatch[2].trim();
        // Remove trailing spaces which typically happen with Logitech
        buttonName = buttonName.replace(/\s+$/, '');
        const block = btnMatch[3].toLowerCase();

        dev.buttons.push({
          cid,
          name: buttonName,
          solaarName: buttonName,
          divertable: block.includes('divertable'),
          rawXy: block.includes('raw_xy') || block.includes('mouse gestures'),
          reprogrammable: block.includes('reprogrammable'),
          position: guessPosition(buttonName),
        });
      }
    }

    devices.push(dev);
  }

  return devices;
}

