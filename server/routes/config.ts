/**
 * Config routes — read/apply Solaar configuration.
 *
 * Now uses the memory-store and config.repo for persistence.
 *
 * GET  /api/config        — read current Solaar config (rules.yaml + config.yaml)
 * POST /api/config        — apply new config
 * PUT  /api/config        — update config in DB without applying
 * POST /api/config/reset  — reset to defaults
 */
import { Router } from 'express';
import { detectSolaar, hostReadFile } from '../services/solaarDetector';
import { generateConfigYaml, generateRulesYaml, parseRulesYaml } from '../services/configGenerator';
import { runScript } from '../services/scriptRunner';
import type { SolaarConfig, ButtonConfig } from '../types';
import {
  updateConfigFromUI,
  persistConfig,
  getCachedConfig,
  snapshotForRollback,
  rollback,
} from '../state/memory-store';
import {
  getConfigByProfile,
  markApplied,
} from '../db/repositories/config.repo';

const router = Router();

// GET /api/config — read current Solaar configuration
router.get('/config', async (_req, res) => {
  try {
    const status = await detectSolaar();
    if (!status.installed || !status.configDir) {
      return res.status(404).json({ ok: false, error: 'Solaar not installed or config dir not found' });
    }

    const configPath = `${status.configDir}/config.yaml`;
    const rulesPath = `${status.configDir}/rules.yaml`;

    let configYaml = '';
    let rulesYaml = '';
    try { configYaml = await hostReadFile(configPath); } catch { /* missing is OK */ }
    try { rulesYaml = await hostReadFile(rulesPath); } catch { /* missing is OK */ }

    const rules = parseRulesYaml(rulesYaml);

    res.json({
      ok: true,
      data: {
        configYaml,
        rulesYaml,
        rules,
        configDir: status.configDir,
        installType: status.installType,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/config — apply Solaar configuration
router.post('/config', async (req, res) => {
  try {
    const { solaarConfig, buttons, profileId } = req.body as {
      solaarConfig: SolaarConfig;
      buttons: ButtonConfig[];
      profileId?: string;
    };

    const status = await detectSolaar();
    if (!status.installed || !status.configDir) {
      return res.status(500).json({ ok: false, error: 'Solaar not found' });
    }

    // If profileId provided, cache and persist the config
    if (profileId) {
      // Take snapshot for rollback
      snapshotForRollback(profileId);

      // Update memory-store → generates parser YAML
      updateConfigFromUI(
        profileId,
        buttons,
        solaarConfig.deviceName,
        profileId,
      );

      // Persist to DB
      persistConfig(profileId);
    }

    // Read existing config to merge into
    let existingConfig = '';
    try { existingConfig = await hostReadFile(`${status.configDir}/config.yaml`); } catch { /* OK */ }

    // Generate YAML content (using the original configGenerator for Solaar apply)
    const configYaml = generateConfigYaml(existingConfig, solaarConfig);
    const rulesYaml = generateRulesYaml(buttons);

    // Use shell script to atomically write + restart
    const stdin = `${configYaml}\n---RULES---\n${rulesYaml}`;
    const output = await runScript('apply-solaar.sh', [status.installType, status.configDir], stdin);

    // Mark config as applied
    if (profileId) {
      const config = getConfigByProfile(profileId);
      if (config) {
        markApplied(config.id);
      }
    }

    res.json({ ok: true, data: { output } });
  } catch (err: unknown) {
    // Rollback on failure
    const snapshot = rollback();
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: msg,
      rolledBack: !!snapshot,
    });
  }
});

// PUT /api/config — save config to DB without applying to Solaar
router.put('/config', async (req, res) => {
  try {
    const { buttons, profileId, deviceId, profileName } = req.body as {
      buttons: ButtonConfig[];
      profileId: string;
      deviceId: string;
      profileName: string;
    };

    // Update memory-store
    const entry = updateConfigFromUI(profileId, buttons, deviceId, profileName);

    // Persist to DB
    const saved = persistConfig(profileId);

    res.json({
      ok: true,
      data: {
        yamlConfig: entry.yaml,
        persisted: !!saved,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/config/reset
router.post('/config/reset', async (_req, res) => {
  try {
    const status = await detectSolaar();
    if (!status.installed || !status.configDir) {
      return res.status(500).json({ ok: false, error: 'Solaar not found' });
    }

    const output = await runScript('reset-solaar.sh', [status.installType, status.configDir]);
    res.json({ ok: true, data: { output } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
