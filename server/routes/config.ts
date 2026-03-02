/**
 * GET  /api/config — read current Solaar config (rules.yaml + config.yaml)
 * POST /api/config — apply new config
 * POST /api/config/reset — reset to defaults
 */
import { Router } from 'express';
import { detectSolaar, hostReadFile, hostWriteFile, killSolaar, launchSolaar } from '../services/solaarDetector.js';
import { generateConfigYaml, generateRulesYaml, parseRulesYaml } from '../services/configGenerator.js';
import { runScript } from '../services/scriptRunner.js';
import type { SolaarConfig, ButtonConfig } from '../types.js';

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

    // Read existing config to merge into
    let existingConfig = '';
    try { existingConfig = await hostReadFile(`${status.configDir}/config.yaml`); } catch { /* OK */ }

    // Generate YAML content
    const configYaml = generateConfigYaml(existingConfig, solaarConfig);
    const rulesYaml = generateRulesYaml(buttons);

    // Use shell script to atomically write + restart
    const stdin = `${configYaml}\n---RULES---\n${rulesYaml}`;
    const output = await runScript('apply-solaar.sh', [status.installType, status.configDir], stdin);

    res.json({ ok: true, data: { output } });
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
