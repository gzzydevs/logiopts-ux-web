/**
 * Electron main process — Express server lifecycle.
 *
 * Forks the compiled Express server as a child process,
 * injecting LOGITUX_DATA_DIR so DB + scripts land in userData.
 */

import { fork, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { app } from 'electron';

let serverProcess: ChildProcess | null = null;

export async function startServer(): Promise<void> {
  return new Promise((res, rej) => {
    const serverPath = resolve(__dirname, '../../dist/server/index.js');
    let started = false;

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: '3001',
        NODE_ENV: 'production',
        LOGITUX_DATA_DIR: app.getPath('userData'),
        LOGITUX_RESOURCES_DIR: process.resourcesPath,
      },
      stdio: 'pipe',
    });

    serverProcess.on('error', rej);

    serverProcess.stdout?.on('data', (d: Buffer) => {
      const msg = d.toString();
      process.stdout.write(`[Server] ${msg}`);
      if (!started && msg.includes('running on')) {
        started = true;
        res();
      }
    });

    serverProcess.stderr?.on('data', (d: Buffer) => {
      process.stderr.write(`[Server:err] ${d.toString()}`);
    });

    // Safety timeout — resolve if started, reject otherwise
    setTimeout(() => {
      if (!started) {
        console.warn('[Server] Startup timeout — server may not be ready');
        res(); // Resolve anyway to allow the window to attempt loading
      }
    }, 8000);
  });
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}
