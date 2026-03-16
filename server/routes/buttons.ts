/**
 * GET /api/device — auto-detect connected Logitech device via `solaar show`
 * GET /api/device/status — Solaar installation status
 * GET /api/device/system-actions — available system actions
 */
import { Router } from 'express';
import { detectSolaar, getSolaarShowCommand, hostShell, parseSolaarShow } from '../services/solaarDetector';
import { CID_MAP, KNOWN_DEVICES, SYSTEM_ACTIONS } from '../services/deviceDatabase';
import { upsertDevice, updateDeviceLayout, getDeviceById, getAllDevices } from '../db/repositories/device.repo';
import { setCurrentDevice } from '../state/memory-store';
import type { KnownDevice, KnownButton } from '../types';

const router = Router();

// GET /api/device/status
router.get('/device/status', async (_req, res) => {
  try {
    const status = await detectSolaar();
    res.json({ ok: true, data: status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/device
router.get('/device', async (_req, res) => {
  try {
    const status = await detectSolaar();
    if (!status.installed) {
      return res.status(404).json({ ok: false, error: 'Solaar is not installed' });
    }

    // Run solaar show
    const showCmd = getSolaarShowCommand(status.installType);
    let output: string;
    try {
      output = await hostShell(showCmd, 15000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Solaar show failed';
      return res.status(500).json({ ok: false, error: msg });
    }

    const parsed = parseSolaarShow(output);
    if (parsed.length === 0) {
      return res.status(404).json({ ok: false, error: 'No Logitech devices found' });
    }

    // Use first device (typically the mouse)
    const dev = parsed[0];

    // Enrich from local database
    const known = KNOWN_DEVICES[dev.name];
    const device: KnownDevice = {
      displayName: known?.displayName || dev.name,
      solaarName: dev.name,
      unitId: dev.unitId,
      pid: known?.pid || 0,
      maxDpi: known?.maxDpi || 4000,
      minDpi: known?.minDpi || 400,
      dpiStep: known?.dpiStep || 100,
      svgId: known?.svgId || 'generic',
      battery: dev.battery,
      buttons: dev.buttons.map((b, i) => {
        // Try to match by Solaar name to our CID map
        const cidEntry = Object.entries(CID_MAP).find(
          ([_, v]) => v.solaarName === b.name
        );
        const cid = cidEntry ? parseInt(cidEntry[0], 10) : 1000 + i;
        const meta = cidEntry ? CID_MAP[cid] : undefined;

        return {
          cid,
          name: meta?.name || b.name,
          solaarName: b.name,
          divertable: b.divertable,
          rawXy: b.rawXy,
          reprogrammable: b.reprogrammable,
          position: meta?.position || `unknown-${i}`,
        } satisfies KnownButton;
      }),
    };

    // Cache device in DB and memory store
    upsertDevice(device);
    setCurrentDevice(device);

    res.json({
      ok: true,
      data: {
        device,
        dpi: dev.dpi,
        divertKeys: dev.divertKeys,
        installType: status.installType,
        configDir: status.configDir,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/device/system-actions
router.get('/device/system-actions', (_req, res) => {
  res.json({ ok: true, data: SYSTEM_ACTIONS });
});

// PUT /api/device/:id/layout — save button layout positions
router.put('/device/:id/layout', (req, res) => {
  try {
    const { id } = req.params;
    const { layout } = req.body as { layout: Record<number, { x: number; y: number }> };

    if (!layout || typeof layout !== 'object') {
      return res.status(400).json({ ok: false, error: 'Missing or invalid layout object' });
    }

    updateDeviceLayout(id, layout);

    // Re-load the device and update memory store
    const device = getDeviceById(id);
    if (device) {
      setCurrentDevice(device);
    }

    res.json({ ok: true, data: { saved: true } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
