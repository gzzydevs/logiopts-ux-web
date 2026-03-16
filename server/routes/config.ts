/**
 * GET  /api/config — read current Solaar config (rules.yaml + config.yaml)
 * POST /api/config — apply new config
 * PUT  /api/config — save to DB without applying to Solaar
 * POST /api/config/reset — reset to defaults
 */
import { Router } from 'express';
import { detectSolaar, hostReadFile } from '../services/solaarDetector';
import { parseRulesYaml } from '../services/configGenerator';
import { jsonToSolaarYaml } from '../solaar/index';
import { buttonConfigsToProfileConfig } from '../state/bridge';
import { saveConfig as dbSaveConfig } from '../db/repositories/config.repo';
import { updateProfile } from '../db/repositories/profile.repo';
import { runScript } from '../services/scriptRunner';
import type { SolaarConfig, ButtonConfig } from '../types';

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
    const { solaarConfig, buttons } = req.body as {
      solaarConfig: SolaarConfig;
      buttons: ButtonConfig[];
    };

    const status = await detectSolaar();
    if (!status.installed || !status.configDir) {
      return res.status(500).json({ ok: false, error: 'Solaar not found' });
    }

    // Generate rules.yaml using the NEW parser (correct Solaar format with button names)
    const profileConfig = buttonConfigsToProfileConfig(
      buttons,
      solaarConfig.unitId || solaarConfig.deviceName,
      'default',
    );
    const rulesYaml = jsonToSolaarYaml(profileConfig);

    // Build divert-keys CSV for the shell script (e.g. "83:2,86:2,253:2")
    // The script patches these into the existing config.yaml via sed,
    // preserving Solaar's native format with integer keys.
    const divertPairs: string[] = [];
    for (const [cid, mode] of Object.entries(solaarConfig.divertKeys)) {
      divertPairs.push(`${cid}:${mode}`);
    }
    const divertKeysCsv = divertPairs.join(',');

    // Use shell script to patch config + write rules + restart Solaar
    const output = await runScript(
      'apply-solaar.sh',
      [status.installType, status.configDir, divertKeysCsv],
      rulesYaml,
    );

    res.json({ ok: true, data: { output } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// PUT /api/config — save button config to DB without applying to Solaar
router.put('/config', async (req, res) => {
  try {
    const { buttons, profileId, deviceId, profileName } = req.body as {
      buttons: ButtonConfig[];
      profileId: string;
      deviceId: string;
      profileName: string;
    };

    // Convert UI format to parser format and generate YAML
    const profileConfig = buttonConfigsToProfileConfig(buttons, deviceId, profileName);
    const saved = dbSaveConfig(profileId, profileConfig);

    // Update the profile's buttons in the DB too
    updateProfile(profileId, { buttons });

    res.json({ ok: true, data: { yamlConfig: saved.yamlConfig, persisted: true } });
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
