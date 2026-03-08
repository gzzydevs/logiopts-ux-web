/**
 * Preferences routes — key/value user preferences.
 *
 * GET  /api/preferences       — get all preferences
 * GET  /api/preferences/:key  — get single preference
 * PUT  /api/preferences/:key  — set a preference
 */

import { Router } from 'express';
import {
    getPreference,
    setPreference,
    getAllPreferences,
} from '../db/repositories/preferences.repo';
import { keyListener } from '../services/keyListener.js';

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

        // Toggle keyListener when scriptsEnabled changes
        if (req.params.key === 'scriptsEnabled') {
            if (value === 'true') {
                keyListener.start();
            } else {
                keyListener.stop();
            }
        }

        res.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

export default router;
