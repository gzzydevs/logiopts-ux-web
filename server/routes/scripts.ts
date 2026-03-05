import { Router } from 'express';
import { readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '../../scripts');

const router = Router();

// GET /api/scripts
router.get('/scripts', async (_req, res) => {
    try {
        const files = await readdir(SCRIPTS_DIR);
        const scripts = files.filter(f => f.endsWith('.sh') || f.endsWith('.py') || f.endsWith('.js'));
        res.json({ ok: true, scripts });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ ok: false, error: msg });
    }
});

export default router;
