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
    private children: ReturnType<typeof spawn>[] = [];
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
        if (this.children.length > 0) return;

        const env = { ...process.env, DISPLAY: process.env.DISPLAY || ':0' };
        const runSync = (args: string[]) => {
            if (USE_HOST_SPAWN) {
                return spawnSync('flatpak-spawn', ['--host', ...args], { env });
            }
            return spawnSync(args[0], args.slice(1), { env });
        };

        // Pre-flight: verify xinput is available
        const checkResult = runSync(['xinput', '--version']);
        if (checkResult.status !== 0) {
            xinputMissing = true;
            console.warn('[KeyListener] ⚠  xinput not found — macro key interception DISABLED.');
            return;
        }

        // Parse xinput list to find ALL keyboard slave devices.
        // `xinput test` does NOT support master devices (e.g. id=3 → "unable to find device").
        // Solaar injects synthetic key events via XTest → arrives on "Virtual core XTEST keyboard".
        // Physical Logitech keys → arrive on "Logitech USB Receiver" keyboard slave.
        // We listen on ALL keyboard slaves to cover both paths.
        const listResult = runSync(['xinput', 'list', '--short']);
        const listOut = listResult.stdout?.toString() ?? '';
        console.log('[KeyListener] xinput list output:\n' + listOut);

        const deviceIds: { id: string; name: string }[] = [];
        for (const line of listOut.split('\n')) {
            // Match all slave keyboard devices
            if (/slave\s+keyboard/i.test(line)) {
                const m = line.match(/id=(\d+)/);
                if (m) {
                    const name = line.replace(/\s*↳\s*/, '').replace(/\s*id=\d+.*/, '').trim();
                    deviceIds.push({ id: m[1], name });
                }
            }
        }

        if (deviceIds.length === 0) {
            console.warn('[KeyListener] ⚠  No keyboard slave devices found — macro key interception DISABLED.');
            return;
        }

        console.log(`[KeyListener] Found ${deviceIds.length} keyboard slaves: ${deviceIds.map(d => `${d.name} (id=${d.id})`).join(', ')}`);

        // Spawn one xinput test per slave device
        for (const dev of deviceIds) {
            const [cmd, args]: [string, string[]] = USE_HOST_SPAWN
                ? ['flatpak-spawn', ['--host', 'xinput', 'test', dev.id]]
                : ['xinput', ['test', dev.id]];

            console.log(`[KeyListener] Starting: ${cmd} ${args.join(' ')} — "${dev.name}" (id=${dev.id})`);
            try {
                const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env });

                let buffer = '';
                child.stdout?.on('data', (data) => {
                    buffer += data.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        // xinput test output: "key press   67"
                        const m = line.match(/key press\s+(\d+)/);
                        if (m) {
                            const keycode = parseInt(m[1], 10);
                            const keyName = this.keyMap[keycode];
                            if (keyName) {
                                console.log(`[KeyListener] macro key ${keyName} (keycode=${keycode}) from "${dev.name}" (id=${dev.id})`);
                                this.emit('keydown', keyName);
                            }
                        }
                    }
                });

                child.stderr?.on('data', (data: Buffer) => {
                    const msg = data.toString().trim();
                    if (msg) console.error(`[KeyListener] xinput stderr (device ${dev.id}):`, msg);
                });

                child.on('exit', (code) => {
                    console.warn(`[KeyListener] xinput for device "${dev.name}" (id=${dev.id}) exited with code ${code}`);
                    this.children = this.children.filter(c => c !== child);
                });

                this.children.push(child);
            } catch (e) {
                console.error(`[KeyListener] Failed to start xinput for device ${dev.id}:`, e);
            }
        }
    }

    stop() {
        for (const child of this.children) {
            child.kill();
        }
        this.children = [];
    }
}

export const keyListener = new KeyListener();
