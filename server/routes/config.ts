import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { generateLogidCfg } from '../services/configGenerator.js';
import { runScript } from '../services/scriptRunner.js';
import type { LogidConfig } from '../types.js';

const router = Router();

// GET /api/config — read current logid.cfg
router.get('/config', async (_req, res) => {
  try {
    const content = await readFile('/etc/logid.cfg', 'utf-8');
    res.json({ ok: true, data: { raw: content } });
  } catch {
    res.json({ ok: true, data: { raw: '' } });
  }
});

// POST /api/config — apply new config
router.post('/config', async (req, res) => {
  try {
    const config = req.body as LogidConfig;
    const cfgStr = generateLogidCfg(config);
    await runScript('apply-config.sh', [], cfgStr);
    res.json({ ok: true, data: { applied: true, config: cfgStr } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/config/reset — reset to minimal defaults (no button remaps)
router.post('/config/reset', async (req, res) => {
  try {
    const deviceName = (req.body.deviceName as string) || 'LIFT VERTICAL ERGONOMIC MOUSE';
    const dpi = Number(req.body.dpi) || 2400;
    // Generate minimal config inline and reuse apply-config.sh via stdin
    const minimalCfg = `devices: ({\n  name: "${deviceName}";\n  dpi: ${dpi};\n});\n`;
    await runScript('apply-config.sh', [], minimalCfg);
    res.json({ ok: true, data: { reset: true } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
