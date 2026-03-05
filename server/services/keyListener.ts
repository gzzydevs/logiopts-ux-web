import { spawn } from 'node:child_process';
import EventEmitter from 'node:events';
import { HOST_BIN } from './solaarDetector.js';

export class KeyListener extends EventEmitter {
    private child: ReturnType<typeof spawn> | null = null;
    private keyMap: Record<number, string> = {
        96: 'F12',
        191: 'F13',
        192: 'F14',
        193: 'F15',
    };

    start() {
        if (this.child) return;

        // We use xinput from the host to listen for global key events
        const cmd = HOST_BIN || 'xinput';
        const args = HOST_BIN === 'flatpak-spawn' ? ['--host', 'xinput', 'test-xi2', '--root']
            : HOST_BIN === 'distrobox-host-exec' ? ['xinput', 'test-xi2', '--root']
                : ['test-xi2', '--root'];

        try {
            this.child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });

            let buffer = '';
            this.child.stdout?.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the last incomplete line

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // Look for RawKeyPress events and extract detail (keycode)
                    if (line.includes('EVENT type 13 (RawKeyPress)')) {
                        // The detail line is usually 2 lines down, e.g., "    detail: 96"
                        const match = lines[i + 2]?.match(/detail:\s*(\d+)/);
                        if (match) {
                            const keycode = parseInt(match[1], 10);
                            const keyName = this.keyMap[keycode];
                            if (keyName) {
                                this.emit('keydown', keyName);
                            }
                        }
                    }
                }
            });

            this.child.on('exit', () => {
                this.child = null;
            });
        } catch (e) {
            console.error('[KeyListener] Failed to start xinput:', e);
        }
    }

    stop() {
        if (this.child) {
            this.child.kill();
            this.child = null;
        }
    }
}

export const keyListener = new KeyListener();
