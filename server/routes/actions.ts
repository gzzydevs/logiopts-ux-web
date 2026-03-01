import { Router } from 'express';
import { runScript } from '../services/scriptRunner.js';

const router = Router();

// POST /api/actions/:script
router.post('/actions/:script', async (req, res) => {
  try {
    const args = (req.body.args as string[]) || [];
    const output = await runScript(req.params.script, args);
    res.json({ ok: true, data: { output } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
