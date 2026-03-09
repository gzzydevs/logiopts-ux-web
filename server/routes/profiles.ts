/**
 * Profile routes — CRUD backed by SQLite.
 *
 * Replaces the previous file-based JSON storage in data/profiles/.
 */

import { Router } from 'express';
import type { Profile } from '../types.js';
import {
  createProfile as dbCreate,
  updateProfile as dbUpdate,
  getAllProfiles as dbGetAll,
  getProfileById as dbGetById,
  deleteProfile as dbDelete,
} from '../db/repositories/profile.repo.js';
import {
  updateConfigFromUI,
  persistConfig,
} from '../state/memory-store.js';

const router = Router();

/** Get all profiles (exported so other modules can use it) */
export async function getAllProfiles(): Promise<Profile[]> {
  return dbGetAll();
}

// GET /api/profiles
router.get('/profiles', async (_req, res) => {
  try {
    const profiles = dbGetAll();
    res.json({ ok: true, data: profiles });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/profiles/:id
router.get('/profiles/:id', async (req, res) => {
  try {
    const profile = dbGetById(req.params.id);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Profile not found' });
    }
    res.json({ ok: true, data: profile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/profiles — create new profile
router.post('/profiles', async (req, res) => {
  try {
    const profile = req.body as Profile;
    if (!profile.id) profile.id = crypto.randomUUID();

    const created = dbCreate(profile);

    // Generate and cache the Solaar config
    if (created.buttons && created.buttons.length > 0) {
      updateConfigFromUI(
        created.id,
        created.buttons,
        created.deviceName,
        created.name,
      );
      persistConfig(created.id);
    }

    res.json({ ok: true, data: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// PUT /api/profiles/:id — update existing profile
router.put('/profiles/:id', async (req, res) => {
  try {
    const changes = req.body as Partial<Profile>;
    const updated = dbUpdate(req.params.id, changes);

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Profile not found' });
    }

    // Regenerate and persist config if buttons changed
    if (changes.buttons) {
      updateConfigFromUI(
        updated.id,
        updated.buttons,
        updated.deviceName,
        updated.name,
      );
      persistConfig(updated.id);
    }

    res.json({ ok: true, data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

// DELETE /api/profiles/:id
router.delete('/profiles/:id', async (req, res) => {
  try {
    dbDelete(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
