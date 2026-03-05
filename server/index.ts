import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import buttonsRouter from './routes/buttons.js';
import configRouter from './routes/config.js';
import profilesRouter, { getAllProfiles } from './routes/profiles.js';
import actionsRouter from './routes/actions.js';
import scriptsRouter from './routes/scripts.js';
import { windowWatcher } from './services/windowWatcher.js';
import { applyProfileToSolaar } from './services/profileApplier.js';
import { keyListener } from './services/keyListener.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(express.json());

// API routes
app.use('/api', buttonsRouter);
app.use('/api', configRouter);
app.use('/api', profilesRouter);
app.use('/api', actionsRouter);
app.use('/api', scriptsRouter);

// Serve static React build in production
const distPath = resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => {
  res.sendFile(resolve(distPath, 'index.html'));
});

// Window Watcher Setup
let currentAppliedProfileId: string | null = null;
windowWatcher.on('window-changed', async (windowClass: string) => {
  console.log(`[WindowWatcher] Active window changed to: ${windowClass}`);
  const profiles = await getAllProfiles();

  const matchedProfile = profiles.find(p => p.windowClasses?.includes(windowClass));

  if (matchedProfile) {
    if (currentAppliedProfileId !== matchedProfile.id) {
      console.log(`[WindowWatcher] Applying profile '${matchedProfile.name}' for '${windowClass}'`);
      const success = await applyProfileToSolaar(matchedProfile);
      if (success) {
        currentAppliedProfileId = matchedProfile.id;
      }
    }
  } else {
    // Fallback to 'Default' profile if exists
    const defaultProfile = profiles.find(p => p.name.toLowerCase() === 'default');
    if (defaultProfile && currentAppliedProfileId !== defaultProfile.id) {
      console.log(`[WindowWatcher] Reverting to 'Default' profile`);
      const success = await applyProfileToSolaar(defaultProfile);
      if (success) {
        currentAppliedProfileId = defaultProfile.id;
      }
    }
  }
});
windowWatcher.start();
keyListener.start();
keyListener.on('keydown', async (macroKey) => {
  const activeClass = windowWatcher.getCurrentClass();
  const { handleMacroKey } = await import('./services/profileApplier.js');
  await handleMacroKey(macroKey, activeClass);
});

app.listen(PORT, () => {
  console.log(`LogiTux server running on http://localhost:${PORT}`);

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
