import { Router } from 'express';
import { KNOWN_DEVICES, SYSTEM_ACTIONS } from '../services/deviceDatabase.js';

const router = Router();

// GET /api/device — returns Lift info
router.get('/device', (_req, res) => {
  const device = KNOWN_DEVICES[0];
  res.json({ ok: true, data: device });
});

// GET /api/system-actions
router.get('/system-actions', (_req, res) => {
  res.json({ ok: true, data: SYSTEM_ACTIONS });
});

export default router;
