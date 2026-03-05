import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import EventEmitter from 'node:events';
import { HOST_BIN } from './solaarDetector.js';

const execAsync = promisify(exec);

export class WindowWatcher extends EventEmitter {
    private interval: NodeJS.Timeout | null = null;
    private currentClass: string | null = null;

    start() {
        if (this.interval) return;
        this.interval = setInterval(() => this.poll(), 2000);
        // Initial poll
        this.poll();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    getCurrentClass(): string | null {
        return this.currentClass;
    }

    private async poll() {
        try {
            const windowClass = await this.getActiveWindow();
            if (windowClass && windowClass !== this.currentClass) {
                this.currentClass = windowClass;
                this.emit('window-changed', windowClass);
            }
        } catch (e) {
            // Ignore errors 
        }
    }

    private async getActiveWindow(): Promise<string | null> {
        try {
            // Check if we are running in a Flatpak or Distrobox and prefix appropriately
            const cmd = HOST_BIN === 'flatpak-spawn' ? 'flatpak-spawn --host xdotool getactivewindow getwindowclassname'
                : HOST_BIN === 'distrobox-host-exec' ? 'distrobox-host-exec xdotool getactivewindow getwindowclassname'
                    : 'xdotool getactivewindow getwindowclassname';

            const { stdout } = await execAsync(cmd);
            if (stdout && stdout.trim()) {
                return stdout.trim();
            }
        } catch (e) {
            // Ignore errors (e.g., no active window or xdotool not installed on host)
        }

        return null;
    }
}

// Singleton instance
export const windowWatcher = new WindowWatcher();
