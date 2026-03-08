import { spawn, spawnSync } from 'node:child_process';
import EventEmitter from 'node:events';
import { USE_HOST_SPAWN } from './solaarDetector.js';

export { USE_HOST_SPAWN as USE_HOST_SPAWN_FOR_XINPUT };

/** Set to true if xinput was not found when start() was called */
export let xinputMissing = false;

/** X11 keycodes for F1-F12 (standard Xorg evdev+8 offset) */
export const MACRO_KEY_POOL: Record<string, number> = {
    F1:  67,
    F2:  68,
    F3:  69,
    F4:  70,
    F5:  71,
    F6:  72,
    F7:  73,
    F8:  74,
    F9:  75,
    F10: 76,
    F11: 95,
    F12: 96,
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

        // Pre-flight: verify xinput is available on the host
        const checkCmd = USE_HOST_SPAWN ? 'flatpak-spawn' : 'which';
        const checkArgs = USE_HOST_SPAWN ? ['--host', 'which', 'xinput'] : ['xinput'];
        const check = spawnSync(checkCmd, checkArgs, { stdio: 'ignore' });
        if (check.status !== 0) {
            xinputMissing = true;
            console.warn('[KeyListener] ⚠  xinput not found — macro key interception DISABLED.');
            console.warn('[KeyListener]    To fix: sudo rpm-ostree install xorg-x11-server-utils && systemctl reboot');
            return;
        }

        // We use xinput from the host to listen for global key events.
        // Always use flatpak-spawn --host (same as hostShell) — never distrobox-host-exec,
        // which only works inside a distrobox container.
        const cmd = USE_HOST_SPAWN ? 'flatpak-spawn' : 'xinput';
        const args = USE_HOST_SPAWN
            ? ['--host', 'xinput', 'test-xi2', '--root']
            : ['test-xi2', '--root'];

        console.log(`[KeyListener] Starting: ${cmd} ${args.join(' ')}`);
        try {
            this.child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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

            this.child.stderr?.on('data', (data: Buffer) => {
                console.error('[KeyListener] xinput stderr:', data.toString().trim());
            });

            this.child.on('exit', (code) => {
                console.warn(`[KeyListener] xinput exited with code ${code}`);
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
