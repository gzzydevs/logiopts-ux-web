import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '../../scripts');

const ALLOWED_SCRIPTS = ['apply-solaar.sh', 'reset-solaar.sh', 'monitor-colors.sh', 'volume.sh', 'brightness.sh', 'nightshift.sh'];

export function runScript(name: string, args: string[] = [], stdin?: string): Promise<string> {
  if (!ALLOWED_SCRIPTS.includes(name)) {
    return Promise.reject(new Error(`Script not allowed: ${name}`));
  }

  const scriptPath = resolve(SCRIPTS_DIR, name);

  // Node runs inside the VS Code Flatpak sandbox — use flatpak-spawn to
  // execute scripts on the host where sudo/systemctl are available.
  return new Promise((res, rej) => {
    const child = execFile('flatpak-spawn', ['--host', 'bash', scriptPath, ...args], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return rej(new Error(stderr || err.message));
      res(stdout.trim());
    });
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}
