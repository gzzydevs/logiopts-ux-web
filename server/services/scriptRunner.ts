import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USE_HOST_SPAWN } from './solaarDetector.js';
import { getScriptById } from '../db/repositories/script.repo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '../../scripts');

/**
 * Run a known script by name (for internal use like apply-solaar.sh).
 * Falls back to disk path if not found in DB.
 */
export function runScript(name: string, args: string[] = [], stdin?: string): Promise<string> {
  const scriptPath = resolve(SCRIPTS_DIR, name);
  return execScript(scriptPath, args, stdin);
}

/**
 * Run a user script by its DB id. Validates existence and executable flag.
 */
export function runScriptById(scriptId: string, args: string[] = [], stdin?: string): Promise<string> {
  const script = getScriptById(scriptId);
  if (!script) return Promise.reject(new Error(`Script not found: ${scriptId}`));
  if (!script.executable) return Promise.reject(new Error(`Script is not executable: ${script.name}`));
  console.log(`[Script] Running: ${script.name} (${script.path})`);
  return execScript(script.path, args, stdin).then(out => {
    if (out) console.log(`[Script] ${script.name} output:\n${out}`);
    else console.log(`[Script] ${script.name} exited OK (no output)`);
    return out;
  }).catch(err => {
    console.error(`[Script] ${script.name} failed: ${err.message}`);
    throw err;
  });
}

function execScript(scriptPath: string, args: string[] = [], stdin?: string): Promise<string> {
  // Mirror hostShell: use flatpak-spawn --host when USE_HOST_SPAWN is true.
  // Never use distrobox-host-exec here — that only works inside a distrobox container.
  const cmd = USE_HOST_SPAWN ? 'flatpak-spawn' : 'bash';
  const cmdArgs = USE_HOST_SPAWN
    ? ['--host', 'bash', scriptPath, ...args]
    : [scriptPath, ...args];

  return new Promise((res, rej) => {
    const child = execFile(cmd, cmdArgs, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return rej(new Error(stderr || err.message));
      res(stdout.trim());
    });
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}
