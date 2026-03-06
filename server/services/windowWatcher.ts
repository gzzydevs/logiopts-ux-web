import EventEmitter from 'node:events';
import { hostShell } from './solaarDetector.js';

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
            // hostShell already handles flatpak-spawn / distrobox-host-exec transparently
            const result = await hostShell('xdotool getactivewindow getwindowclassname 2>/dev/null');
            return result.trim() || null;
        } catch {
            return null;
        }
    }
}

// Singleton instance
export const windowWatcher = new WindowWatcher();
