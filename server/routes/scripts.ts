/**
 * Script routes — CRUD backed by SQLite + disk sync.
 *
 * Replaces the previous read-only file listing.
 */

import { Router } from 'express';
import {
    createScript,
    updateScript,
    getAllScripts,
    getScriptById,
    deleteScript,
    seedFromDisk,
} from '../db/repositories/script.repo';
import { runScriptById } from '../services/scriptRunner';
import { MACRO_KEY_POOL } from '../services/keyListener';
import { getAllProfiles } from './profiles';

const router = Router();

// Seed existing scripts from disk on first import
seedFromDisk();

// GET /api/scripts — list all scripts
router.get('/scripts', async (_req, res) => {
    try {
        const scripts = getAllScripts();
        res.json({ ok: true, data: scripts });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// GET /api/scripts/macro-keys — available macro keys and which are in use
// (Must be before /scripts/:id to avoid param capture)
router.get('/scripts/macro-keys', async (_req, res) => {
    try {
        const available = Object.keys(MACRO_KEY_POOL);
        const inUse: Record<string, string> = {};

        const profiles = await getAllProfiles();
        for (const profile of profiles) {
            for (const btn of profile.buttons) {
                if (btn.gestureMode) {
                    for (const dir in btn.gestures) {
                        const action = btn.gestures[dir as keyof typeof btn.gestures];
                        if (action.type === 'RunScript' && action.macroKey) {
                            inUse[action.macroKey] = `${profile.name}:cid-${btn.cid}:${dir}`;
                        }
                    }
                } else if (btn.simpleAction?.type === 'RunScript' && btn.simpleAction.macroKey) {
                    inUse[btn.simpleAction.macroKey] = `${profile.name}:cid-${btn.cid}`;
                }
            }
        }

        res.json({ ok: true, data: { available, inUse } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// GET /api/scripts/:id — get a single script
router.get('/scripts/:id', async (req, res) => {
    try {
        const script = getScriptById(req.params.id);
        if (!script) {
            return res.status(404).json({ ok: false, error: 'Script not found' });
        }
        res.json({ ok: true, data: script });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// POST /api/scripts — create a new script
router.post('/scripts', async (req, res) => {
    try {
        const { name, content, executable } = req.body as {
            name: string;
            content: string;
            executable?: boolean;
        };

        if (!name || !content) {
            return res.status(400).json({ ok: false, error: 'name and content are required' });
        }

        const script = createScript({ name, content, executable });
        res.json({ ok: true, data: script });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// PUT /api/scripts/:id — update a script
router.put('/scripts/:id', async (req, res) => {
    try {
        const changes = req.body as { name?: string; content?: string; executable?: boolean };
        const updated = updateScript(req.params.id, changes);

        if (!updated) {
            return res.status(404).json({ ok: false, error: 'Script not found' });
        }

        res.json({ ok: true, data: updated });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// DELETE /api/scripts/:id — delete a script
router.delete('/scripts/:id', async (req, res) => {
    try {
        deleteScript(req.params.id);
        res.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

// POST /api/scripts/:id/test — execute a script and return output
router.post('/scripts/:id/test', async (req, res) => {
    try {
        const script = getScriptById(req.params.id);
        if (!script) {
            return res.status(404).json({ ok: false, error: 'Script not found' });
        }
        const output = await runScriptById(req.params.id);
        res.json({ ok: true, data: { output, exitCode: 0 } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.json({ ok: true, data: { output: msg, exitCode: 1 } });
    }
});

export default router;
