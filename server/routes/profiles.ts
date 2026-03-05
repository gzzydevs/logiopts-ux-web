import { Router } from 'express';
import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Profile } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = resolve(__dirname, '../../data/profiles');

async function ensureDir() {
  await mkdir(PROFILES_DIR, { recursive: true });
}

const router = Router();

export async function getAllProfiles(): Promise<Profile[]> {
  try {
    await ensureDir();
    const files = await readdir(PROFILES_DIR);
    const profiles: Profile[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = await readFile(resolve(PROFILES_DIR, f), 'utf-8');
      try {
        profiles.push(JSON.parse(data));
      } catch { }
    }
    return profiles.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// GET /api/profiles
router.get('/profiles', async (_req, res) => {
  try {
    const profiles = await getAllProfiles();
    res.json({ ok: true, data: profiles });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/profiles
router.post('/profiles', async (req, res) => {
  try {
    await ensureDir();
    const profile = req.body as Profile;
    if (!profile.id) profile.id = crypto.randomUUID();
    profile.updatedAt = new Date().toISOString();
    if (!profile.createdAt) profile.createdAt = profile.updatedAt;
    await writeFile(resolve(PROFILES_DIR, `${profile.id}.json`), JSON.stringify(profile, null, 2));
    res.json({ ok: true, data: profile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// DELETE /api/profiles/:id
router.delete('/profiles/:id', async (req, res) => {
  try {
    await unlink(resolve(PROFILES_DIR, `${req.params.id}.json`));
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
