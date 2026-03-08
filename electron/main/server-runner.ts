import { fork, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { app } from 'electron';

let serverProcess: ChildProcess | null = null;

export async function startServer(): Promise<void> {
  return new Promise((resolve_, reject) => {
    const serverPath = resolve(__dirname, '../../dist/server/index.js');
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

    serverProcess.on('error', reject);

    serverProcess.stdout?.on('data', (d: Buffer) => {
      const msg = d.toString();
      process.stdout.write(`[server] ${msg}`);
      if (msg.includes('running on')) resolve_();
    });

    serverProcess.stderr?.on('data', (d: Buffer) => {
      process.stderr.write(`[server:err] ${d.toString()}`);
    });

    // Safety timeout — resolve after 5s even if no "running on" message
    setTimeout(resolve_, 5000);
  });
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}
