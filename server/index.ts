import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import buttonsRouter from './routes/buttons.js';
import configRouter from './routes/config.js';
import profilesRouter, { getAllProfiles } from './routes/profiles.js';
import actionsRouter from './routes/actions.js';
import scriptsRouter from './routes/scripts.js';
import mockRouter from './mock/routes.js';
import preferencesRouter from './routes/preferences.js';
import eventsRouter from './routes/events.js';
import { windowWatcher } from './services/windowWatcher.js';
import { applyProfileToSolaar } from './services/profileApplier.js';
import { keyListener } from './services/keyListener.js';
import { bootstrap, setCurrentDevice, setActiveProfile, getActiveProfileId, emitStoreEvent } from './state/memory-store.js';
import { detectSolaar, getSolaarShowCommand, hostShell, parseSolaarShow, hostReadFile } from './services/solaarDetector.js';
import { CID_MAP, KNOWN_DEVICES } from './services/deviceDatabase.js';
import { upsertDevice } from './db/repositories/device.repo.js';
import { createProfile } from './db/repositories/profile.repo.js';
import { getPreference, setPreference } from './db/repositories/preferences.repo.js';
import { solaarYamlToJson } from './solaar/index.js';
import { profileConfigToButtonConfigs } from './state/bridge.js';
import type { KnownDevice, KnownButton, ButtonConfig } from './types.js';

// Initialize DB (runs schema.sql on first boot)
import './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// When MOCK_MODE=true (e.g. `npm run dev:cloud`), all API requests are handled
// by the mock router — no Solaar installation or real hardware is required.
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Tracks last applied profile for window-watcher auto-switching (real mode only)
let currentAppliedProfileId: string | null = null;

app.use(express.json());

// API routes
if (MOCK_MODE) {
  console.log('[LogiTux] *** MOCK MODE ACTIVE — using pre-configured MX Master 3 data ***');
  app.use('/api', mockRouter);
} else {
  app.use('/api', buttonsRouter);
  app.use('/api', configRouter);
  app.use('/api', profilesRouter);
  app.use('/api', actionsRouter);
  app.use('/api', scriptsRouter);
  app.use('/api', preferencesRouter);
  app.use('/api', eventsRouter);
}

// Real bootstrap + watcher + keyListener — skipped in mock mode (handled by mockRouter)
if (!MOCK_MODE) {

// Bootstrap endpoint — returns everything the UI needs on first load
// Auto-detects device and creates Default profile from current Solaar config if needed.
app.get('/api/bootstrap', async (_req, res) => {
  try {
    let data = bootstrap();

    // Restore active profile from preferences if not set
    if (!getActiveProfileId()) {
      const lastActiveId = getPreference('lastActiveProfileId');
      if (lastActiveId) {
        const validProfile = data.profiles.find(p => p.id === lastActiveId);
        if (validProfile) {
          setActiveProfile(lastActiveId, 'bootstrap');
        }
      }
    }

    // 1. If no devices in DB, auto-detect via Solaar
    if (data.devices.length === 0) {
      try {
        console.log('[Bootstrap] No devices in DB, auto-detecting...');
        const status = await detectSolaar();
        if (status.installed) {
          const showCmd = getSolaarShowCommand(status.installType);
          console.log(`[Bootstrap] Running: ${showCmd}`);
          const output = await hostShell(showCmd, 30000);
          console.log(`[Bootstrap] Got ${output.length} chars from solaar show`);
          const parsed = parseSolaarShow(output);
          console.log(`[Bootstrap] Parsed ${parsed.length} devices, first has ${parsed[0]?.buttons?.length ?? 0} buttons`);

          if (parsed.length > 0) {
            const dev = parsed[0];
            const known = KNOWN_DEVICES[dev.name];
            // Reuse the same enrichment logic as GET /api/device
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
                const cidEntry = Object.entries(CID_MAP).find(
                  ([_, v]) => v.solaarName === b.name
                );
                const mappedCid = cidEntry ? parseInt(cidEntry[0], 10) : (1000 + i);
                const meta = cidEntry ? CID_MAP[mappedCid] : undefined;
                return {
                  cid: mappedCid,
                  name: meta?.name || b.name,
                  solaarName: b.name,
                  divertable: b.divertable,
                  rawXy: b.rawXy,
                  reprogrammable: b.reprogrammable,
                  position: meta?.position || `unknown-${i}`,
                } as KnownButton;
              }),
            };
            console.log(`[Bootstrap] Created device: ${device.displayName} with ${device.buttons.length} buttons: ${device.buttons.map(b => b.name).join(', ')}`);
            upsertDevice(device);
            setCurrentDevice(device);
            // Re-read from DB after insert
            data = bootstrap();
            console.log(`[Bootstrap] After upsert, DB has ${data.devices[0]?.buttons?.length ?? 0} buttons`);
          }
        }
      } catch (err) {
        console.warn('[Bootstrap] Auto-detect failed:', err);
      }
    }

    // 2. If no profiles, create Default from current Solaar config
    if (data.profiles.length === 0 && data.devices.length > 0) {
      const device = data.devices[0];
      let buttons: ButtonConfig[] = [];

      // Build reverse map: Solaar button name → CID number
      const nameToCid = new Map<string, number>();
      for (const [cidStr, meta] of Object.entries(CID_MAP)) {
        nameToCid.set(meta.solaarName, parseInt(cidStr, 10));
      }

      try {
        // Try to read current Solaar rules and convert to ButtonConfig[]
        const status = await detectSolaar();
        if (status.installed && status.configDir) {
          const rulesPath = `${status.configDir}/rules.yaml`;
          let rulesYaml = '';
          try { rulesYaml = await hostReadFile(rulesPath); } catch { /* no rules yet */ }

          if (rulesYaml.trim()) {
            // Parse YAML → ProfileConfig → ButtonConfig[]
            const profileConfig = solaarYamlToJson(rulesYaml, device.unitId, 'Default');
            buttons = profileConfigToButtonConfigs(profileConfig);

            // Fix CIDs: profileConfigToButtonConfigs uses ButtonMapping.id which is the button name,
            // not a "CID-xxx" format. We need to map names back to real Logitech CIDs.
            for (const btn of buttons) {
              if (btn.cid === 0) {
                // Find the matching ButtonMapping to get the button name
                const mapping = profileConfig.buttons[buttons.indexOf(btn)];
                if (mapping) {
                  const realCid = nameToCid.get(mapping.id);
                  if (realCid !== undefined) {
                    btn.cid = realCid;
                    console.log(`[Bootstrap] Mapped "${mapping.id}" → CID ${realCid}`);
                  }
                }
              }
            }

            console.log(`[Bootstrap] Parsed ${buttons.length} button configs from current rules.yaml`);
          }
        }
      } catch (err) {
        console.warn('[Bootstrap] Failed to read current Solaar config:', err);
      }

      // If we couldn't parse existing config, create empty button configs for divertable buttons
      if (buttons.length === 0) {
        buttons = device.buttons
          .filter(b => b.divertable)
          .map(b => ({
            cid: b.cid,
            gestureMode: false,
            gestures: {
              None: { type: 'None' as const },
              Up: { type: 'None' as const },
              Down: { type: 'None' as const },
              Left: { type: 'None' as const },
              Right: { type: 'None' as const },
            },
            simpleAction: { type: 'None' as const },
          }));
      }

      // Create the Default profile
      const now = new Date().toISOString();
      createProfile({
        id: crypto.randomUUID(),
        name: 'Default',
        deviceName: device.unitId,
        buttons,
        windowClasses: [],
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[Bootstrap] Created Default profile with ${buttons.length} buttons`);

      // Re-read from DB after profile creation
      data = bootstrap();
    }

    res.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Bootstrap] Error:', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// Window Watcher API — MUST be before catch-all
app.get('/api/watcher/status', (_req, res) => {
  const isRunning = (windowWatcher as any).interval !== null;
  res.json({ active: isRunning });
});

app.post('/api/watcher/toggle', (req, res) => {
  const { active } = req.body;
  if (active) {
    windowWatcher.start();
    console.log('[WindowWatcher] Started manually via API');
  } else {
    windowWatcher.stop();
    console.log('[WindowWatcher] Stopped manually via API');
  }
  // Persist watcher preference
  setPreference('windowWatcherEnabled', active ? 'true' : 'false');
  emitStoreEvent({ type: 'watcher-status', payload: { active } });
  res.json({ success: true, active });
});

// Active Profile API
app.get('/api/active-profile', (_req, res) => {
  res.json({ ok: true, data: { profileId: getActiveProfileId() } });
});

app.post('/api/active-profile', async (req, res) => {
  const { profileId } = req.body as { profileId: string };
  if (!profileId) {
    return res.status(400).json({ ok: false, error: 'Missing profileId' });
  }
  setActiveProfile(profileId, 'user');
  setPreference('lastActiveProfileId', profileId);
  res.json({ ok: true, data: { profileId } });
});

// Restore window watcher from preferences on startup
const watcherPref = getPreference('windowWatcherEnabled');
if (watcherPref === 'true') {
  windowWatcher.start();
  console.log('[WindowWatcher] Auto-started from preferences');
}

} // end !MOCK_MODE (bootstrap + watcher API routes)

// Serve static React build in production
const distPath = resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => {
  res.sendFile(resolve(distPath, 'index.html'));
});

if (!MOCK_MODE) {
// Window Watcher event handler
// Composite key "windowClass::profileId" — dedup on the (window, target-profile) pair so
// that switching to a different profile for the same window (e.g. a newly-created profile)
// is always picked up, while redundant applies for the current pair are skipped.
let lastWatcherKey: string | null = null;

windowWatcher.on('window-changed', async (windowClass: string) => {
  const profiles = await getAllProfiles();

  // Case-insensitive match so "Firefox" == "firefox" regardless of how the user typed it
  const windowClassLower = windowClass.toLowerCase();
  const matchedProfile = profiles.find(p =>
    p.windowClasses && p.windowClasses.length > 0 &&
    p.windowClasses.some(wc => wc.toLowerCase() === windowClassLower)
  );

  // Determine target: matched profile, or fall back to Default → first profile
  const target = matchedProfile
    ?? profiles.find(p => p.name.toLowerCase() === 'default')
    ?? profiles[0];

  if (!target) return;

  // Skip only when BOTH the active window AND the target profile are unchanged
  const key = `${windowClassLower}::${target.id}`;
  if (key === lastWatcherKey) return;

  // Commit to this (window, profile) pair before applying — this prevents
  // infinite retries if applyProfileToSolaar is slow or fails.
  lastWatcherKey = key;

  console.log(`[WindowWatcher] Switching to profile '${target.name}' for window '${windowClass}'`);
  const success = await applyProfileToSolaar(target);
  if (success) {
    // Update server state without emitting (bootstrap trigger skips SSE emission);
    // we emit manually below to include profileName in the payload.
    setActiveProfile(target.id, 'bootstrap');
    setPreference('lastActiveProfileId', target.id);
    emitStoreEvent({
      type: 'profile-switched',
      payload: { profileId: target.id, profileName: target.name, trigger: 'watcher' },
    });
  }
});



keyListener.start();
keyListener.on('keydown', async (macroKey) => {
  const activeClass = windowWatcher.getCurrentClass();
  const { handleMacroKey } = await import('./services/profileApplier.js');
  await handleMacroKey(macroKey, activeClass);
});

} // end !MOCK_MODE

app.listen(PORT, () => {
  console.log(`LogiTux server running on http://localhost:${PORT}`);
  if (MOCK_MODE) {
    console.log('[LogiTux] Mock mode — API uses pre-configured MX Master 3 data, no Solaar required');
    return;
  }

  // ENVIRONMENT DIAGNOSTICS FOR BAZZITE
  try {
    import('node:child_process').then(({ execSync }) => {
      import('node:fs').then(({ existsSync }) => {
        console.log('[DIAGNOSTICS] has flatpak-spawn:', existsSync('/usr/bin/flatpak-spawn'));
        console.log('[DIAGNOSTICS] has distrobox-host-exec:', existsSync('/usr/bin/distrobox-host-exec'));
        console.log('[DIAGNOSTICS] has xdotool natively:', existsSync('/usr/bin/xdotool'));
        console.log('[DIAGNOSTICS] /.flatpak-info exists:', existsSync('/.flatpak-info'));
        console.log('[DIAGNOSTICS] /run/.containerenv exists:', existsSync('/run/.containerenv'));
        console.log('[DIAGNOSTICS] /run/.toolboxenv exists:', existsSync('/run/.toolboxenv'));
        try { console.log('[DIAGNOSTICS] which flatpak-spawn:', execSync('which flatpak-spawn', { stdio: 'pipe' }).toString().trim()); } catch { }
        try { console.log('[DIAGNOSTICS] flatpak list:', execSync('flatpak-spawn --host flatpak list --app', { stdio: 'pipe' }).toString().trim()); } catch (e: any) { console.log('[DIAGNOSTICS] flatpak list failed:', e.message); }
      });
    });
  } catch (e) {
    console.log('[DIAGNOSTICS] Error running diagnostics:', e);
  }
});
