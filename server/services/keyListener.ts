import { spawn } from 'node:child_process';
import EventEmitter from 'node:events';
import { USE_HOST_SPAWN, HOST_SPAWN_BIN } from './solaarDetector.js';

/** X11 keycodes for macro keys F13-F20 (standard Xorg) */
export const MACRO_KEY_POOL: Record<string, number> = {
    F13: 191,
    F14: 192,
    F15: 193,
    F16: 194,
    F17: 195,
    F18: 196,
    F19: 197,
    F20: 198,
};

export class KeyListener extends EventEmitter {
    private child: ReturnType<typeof spawn> | null = null;
    private keyMap: Record<number, string> = {};

    constructor() {
        super();
        // Default: listen on all macro keys
        this.setActiveMacroKeys(Object.keys(MACRO_KEY_POOL));
    }

    /** Update which macro keys are actively listened for */
    setActiveMacroKeys(keys: string[]) {
        this.keyMap = {};
        for (const key of keys) {
            const code = MACRO_KEY_POOL[key];
            if (code) this.keyMap[code] = key;
        }
    }

    start() {
        if (this.child) return;

        // We use xinput from the host to listen for global key events
        const cmd = USE_HOST_SPAWN ? HOST_SPAWN_BIN : 'xinput';
        const args = USE_HOST_SPAWN
            ? (HOST_SPAWN_BIN === 'flatpak-spawn'
                ? ['--host', 'xinput', 'test-xi2', '--root']
                : ['xinput', 'test-xi2', '--root'])
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
