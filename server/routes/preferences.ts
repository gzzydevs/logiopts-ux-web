/**
 * Preferences routes — key/value user preferences.
 *
 * GET  /api/preferences             — get all preferences
 * GET  /api/preferences/:key        — get single preference
 * PUT  /api/preferences/:key        — set a preference
 * GET  /api/preferences/autostart   — check autostart status
 * POST /api/preferences/autostart   — enable/disable autostart
 */

import { Router } from 'express';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import {
    getPreference,
    setPreference,
    getAllPreferences,
} from '../db/repositories/preferences.repo';

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = Router();

// GET /api/preferences — get all
router.get('/preferences', (_req, res) => {
    try {
        const prefs = getAllPreferences();
        res.json({ ok: true, data: prefs });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// GET /api/preferences/autostart — check XDG autostart status
router.get('/preferences/autostart', (_req, res) => {
    try {
        const file = resolve(homedir(), '.config/autostart/logitux.desktop');
        res.json({ ok: true, data: { enabled: existsSync(file) } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// POST /api/preferences/autostart — enable/disable XDG autostart
router.post('/preferences/autostart', (req, res) => {
    try {
        const { enabled } = req.body as { enabled: boolean };
        const dir = resolve(homedir(), '.config/autostart');
        const file = resolve(dir, 'logitux.desktop');

        if (enabled) {
            mkdirSync(dir, { recursive: true });
            const source = resolve(__dirname, '../../packaging/logitux-autostart.desktop');
            copyFileSync(source, file);
        } else {
            if (existsSync(file)) unlinkSync(file);
        }

        setPreference('autostart', enabled ? 'true' : 'false');
        res.json({ ok: true, data: { enabled } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// GET /api/preferences/:key — get single
router.get('/preferences/:key', (req, res) => {
    try {
        const value = getPreference(req.params.key);
        if (value === null) {
            return res.status(404).json({ ok: false, error: 'Preference not found' });
        }
        res.json({ ok: true, data: { value } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// PUT /api/preferences/:key — set
router.put('/preferences/:key', (req, res) => {
    try {
        const { value } = req.body as { value: string };
        if (value === undefined || value === null) {
            return res.status(400).json({ ok: false, error: 'Missing value' });
        }
        setPreference(req.params.key, String(value));

        res.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

export default router;
