/**
 * Mock API router — returns pre-configured data without Solaar or SQLite.
 *
 * Active when the server is started with MOCK_MODE=true (e.g. `npm run dev:cloud`).
 * All mutable state is kept in-memory: profile/script CRUD works fully but
 * resets to seed data on server restart, which is ideal for Playwright testing.
 *
 * Handles every route normally served by:
 *   - server/routes/buttons.ts
 *   - server/routes/config.ts
 *   - server/routes/profiles.ts
 *   - server/routes/scripts.ts
 *   - server/routes/actions.ts
 *   - server/routes/preferences.ts
 *   - server/routes/events.ts
 *   - The inline /api/bootstrap, /api/watcher/*, /api/active-profile handlers in server/index.ts
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Profile, KnownDevice, ButtonConfig } from '../types';
import type { Script } from '../db/repositories/script.repo';
import {
    MOCK_DEVICE,
    MOCK_PROFILES,
    MOCK_SCRIPTS,
    MOCK_SYSTEM_ACTIONS,
} from './data';

const router = Router();

// ─── In-memory state (deep-cloned from seed data, resets on restart) ─────────

const mockDevice: KnownDevice = JSON.parse(JSON.stringify(MOCK_DEVICE));
const mockProfiles: Profile[] = JSON.parse(JSON.stringify(MOCK_PROFILES));
const mockScripts: Script[] = JSON.parse(JSON.stringify(MOCK_SCRIPTS));
let mockWatcherActive = false;
let mockActiveProfileId: string = MOCK_PROFILES[0].id;
const mockPreferences: Record<string, string> = {};

// SSE subscribers for /api/events
const sseClients = new Set<Response>();

function emitMockEvent(type: string, payload: Record<string, unknown>): void {
    const data = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients) {
        try { res.write(data); } catch { /* client disconnected */ }
    }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

router.get('/bootstrap', (_req, res) => {
    res.json({
        ok: true,
        data: {
            devices: [mockDevice],
            profiles: mockProfiles,
            configs: mockProfiles.map(p => ({
                profileId: p.id,
                yamlConfig: `# Mock config for profile: ${p.name}\n`,
                appliedAt: null,
            })),
            scripts: mockScripts,
            preferences: mockPreferences,
            activeProfileId: mockActiveProfileId,
        },
    });
});

// ─── Device ──────────────────────────────────────────────────────────────────

router.get('/device/status', (_req, res) => {
    res.json({
        ok: true,
        data: {
            installed: true,
            installType: 'mock',
            configDir: '/mock/solaar/config',
            version: '1.1.10-mock',
        },
    });
});

router.get('/device', (_req, res) => {
    res.json({
        ok: true,
        data: {
            device: mockDevice,
            dpi: mockProfiles[0]?.dpi ?? 1000,
            divertKeys: { 82: 2, 83: 2, 86: 2, 195: 2, 215: 2, 216: 2, 253: 2 },
            installType: 'mock',
            configDir: '/mock/solaar/config',
        },
    });
});

router.get('/device/system-actions', (_req, res) => {
    res.json({ ok: true, data: MOCK_SYSTEM_ACTIONS });
});

router.put('/device/:id/layout', (req, res) => {
    const { layout } = req.body as {
        layout: Record<number, { x: number; y: number; labelSide?: 'left' | 'right' }>;
    };
    if (!layout || typeof layout !== 'object') {
        return res.status(400).json({ ok: false, error: 'Missing or invalid layout object' });
    }
    for (const btn of mockDevice.buttons) {
        const pos = layout[btn.cid];
        if (pos) {
            (btn as unknown as Record<string, unknown>).layoutX = pos.x;
            (btn as unknown as Record<string, unknown>).layoutY = pos.y;
            if (pos.labelSide) (btn as unknown as Record<string, unknown>).labelSide = pos.labelSide;
        }
    }
    res.json({ ok: true, data: { saved: true } });
});

// ─── Config ──────────────────────────────────────────────────────────────────

router.get('/config', (_req, res) => {
    res.json({
        ok: true,
        data: {
            configYaml: '# Mock Solaar config.yaml (no real hardware)\n',
            rulesYaml: '# Mock Solaar rules.yaml (no real hardware)\n',
            rules: [],
            configDir: '/mock/solaar/config',
            installType: 'mock',
        },
    });
});

router.post('/config', (_req, res) => {
    console.log('[Mock] POST /config — apply simulated (no-op)');
    res.json({ ok: true, data: { output: '[Mock] Config applied successfully (simulated)' } });
});

router.put('/config', (req, res) => {
    const { buttons, profileId } = req.body as {
        buttons: ButtonConfig[];
        profileId: string;
        deviceId: string;
        profileName: string;
    };
    const profile = mockProfiles.find(p => p.id === profileId);
    if (profile && Array.isArray(buttons)) {
        profile.buttons = buttons;
        profile.updatedAt = new Date().toISOString();
    }
    res.json({ ok: true, data: { yamlConfig: '# Mock saved config\n', persisted: true } });
});

router.post('/config/reset', (_req, res) => {
    console.log('[Mock] POST /config/reset — reset simulated (no-op)');
    res.json({ ok: true, data: { output: '[Mock] Config reset (simulated)' } });
});

// ─── Profiles ────────────────────────────────────────────────────────────────

router.get('/profiles', (_req, res) => {
    res.json({ ok: true, data: mockProfiles });
});

router.get('/profiles/:id', (req, res) => {
    const profile = mockProfiles.find(p => p.id === req.params.id);
    if (!profile) return res.status(404).json({ ok: false, error: 'Profile not found' });
    res.json({ ok: true, data: profile });
});

router.post('/profiles', (req, res) => {
    const profile = req.body as Profile;
    if (!profile.id) profile.id = crypto.randomUUID();
    const ts = new Date().toISOString();
    if (!profile.createdAt) profile.createdAt = ts;
    profile.updatedAt = ts;
    mockProfiles.push(profile);
    res.json({ ok: true, data: profile });
});

router.put('/profiles/:id', (req, res) => {
    const idx = mockProfiles.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Profile not found' });
    const changes = req.body as Partial<Profile>;
    mockProfiles[idx] = { ...mockProfiles[idx], ...changes, updatedAt: new Date().toISOString() };
    res.json({ ok: true, data: mockProfiles[idx] });
});

router.delete('/profiles/:id', (req, res) => {
    const idx = mockProfiles.findIndex(p => p.id === req.params.id);
    if (idx !== -1) mockProfiles.splice(idx, 1);
    res.json({ ok: true });
});

// ─── Scripts ─────────────────────────────────────────────────────────────────

router.get('/scripts', (_req, res) => {
    res.json({ ok: true, data: mockScripts });
});

router.get('/scripts/:id', (req, res) => {
    const script = mockScripts.find(s => s.id === req.params.id);
    if (!script) return res.status(404).json({ ok: false, error: 'Script not found' });
    res.json({ ok: true, data: script });
});

router.post('/scripts', (req, res) => {
    const { name, content, executable } = req.body as {
        name: string;
        content: string;
        executable?: boolean;
    };
    if (!name || !content) {
        return res.status(400).json({ ok: false, error: 'name and content are required' });
    }
    const ts = new Date().toISOString();
    const script: Script = {
        id: crypto.randomUUID(),
        name,
        path: `scripts/${name}`,
        content,
        executable: executable ?? true,
        createdAt: ts,
        updatedAt: ts,
    };
    mockScripts.push(script);
    res.json({ ok: true, data: script });
});

router.put('/scripts/:id', (req, res) => {
    const idx = mockScripts.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Script not found' });
    const changes = req.body as Partial<Script>;
    mockScripts[idx] = { ...mockScripts[idx], ...changes, updatedAt: new Date().toISOString() };
    res.json({ ok: true, data: mockScripts[idx] });
});

router.delete('/scripts/:id', (req, res) => {
    const idx = mockScripts.findIndex(s => s.id === req.params.id);
    if (idx !== -1) mockScripts.splice(idx, 1);
    res.json({ ok: true });
});

// ─── Actions ─────────────────────────────────────────────────────────────────

router.post('/actions/:script', (req, res) => {
    const { args } = req.body as { args?: string[] };
    const scriptName = req.params.script;
    console.log(`[Mock] POST /actions/${scriptName} args=${JSON.stringify(args ?? [])}`);
    res.json({
        ok: true,
        data: { output: `[Mock] Script '${scriptName}' executed (args: ${(args ?? []).join(' ')})` },
    });
});

// ─── Window Watcher ──────────────────────────────────────────────────────────

router.get('/watcher/status', (_req, res) => {
    res.json({ active: mockWatcherActive });
});

router.post('/watcher/toggle', (req, res) => {
    const { active } = req.body as { active: boolean };
    mockWatcherActive = !!active;
    mockPreferences.windowWatcherEnabled = mockWatcherActive ? 'true' : 'false';
    console.log(`[Mock] Window watcher ${mockWatcherActive ? 'started' : 'stopped'} (simulated)`);
    emitMockEvent('watcher-status', { active: mockWatcherActive });
    res.json({ success: true, active: mockWatcherActive });
});

// ─── Active Profile ──────────────────────────────────────────────────────────

router.get('/active-profile', (_req, res) => {
    res.json({ ok: true, data: { profileId: mockActiveProfileId } });
});

router.post('/active-profile', (req, res) => {
    const { profileId } = req.body as { profileId: string };
    if (!profileId) {
        return res.status(400).json({ ok: false, error: 'Missing profileId' });
    }
    mockActiveProfileId = profileId;
    mockPreferences.lastActiveProfileId = profileId;
    res.json({ ok: true, data: { profileId } });
});

// ─── Preferences ─────────────────────────────────────────────────────────────

router.get('/preferences', (_req, res) => {
    res.json({ ok: true, data: mockPreferences });
});

router.get('/preferences/:key', (req, res) => {
    const value = mockPreferences[req.params.key];
    if (value === undefined) {
        return res.status(404).json({ ok: false, error: 'Preference not found' });
    }
    res.json({ ok: true, data: { value } });
});

router.put('/preferences/:key', (req, res) => {
    const { value } = req.body as { value: string };
    mockPreferences[req.params.key] = String(value);
    res.json({ ok: true, data: { value: mockPreferences[req.params.key] } });
});

// ─── SSE Events ──────────────────────────────────────────────────────────────

router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

export default router;
