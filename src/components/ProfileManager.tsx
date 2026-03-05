import { useState } from 'react';
import type { Profile, ButtonConfig } from '../types';
import { fetchProfiles, saveProfile, deleteProfile } from '../hooks/useApi';

interface ProfileManagerProps {
  deviceName: string;
  currentDpi: number;
  currentButtons: ButtonConfig[];
  onLoadProfile: (profile: Profile) => void;
}

export default function ProfileManager({ deviceName, currentDpi, currentButtons, onLoadProfile }: ProfileManagerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [windowClasses, setWindowClasses] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadProfiles() {
    setLoading(true);
    try {
      const data = await fetchProfiles();
      setProfiles(data.filter(p => p.deviceName === deviceName));
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
    setLoading(false);
  }

  async function handleOpen() {
    setOpen(true);
    await loadProfiles();
  }

  async function handleSave() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const appClasses = windowClasses.split(',').map(s => s.trim()).filter(Boolean);
      const profile: Profile = {
        id: '',
        name: newName.trim(),
        deviceName,
        dpi: currentDpi,
        buttons: currentButtons,
        windowClasses: appClasses.length > 0 ? appClasses : undefined,
        createdAt: '',
        updatedAt: '',
      };
      await saveProfile(profile);
      setNewName('');
      setWindowClasses('');
      await loadProfiles();
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await deleteProfile(id);
      await loadProfiles();
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="btn btn-secondary" onClick={handleOpen}>
        📁 Profiles
      </button>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal profile-manager">
        <h3>Profiles — {deviceName}</h3>

        {/* Save new */}
        <div className="profile-save-row">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Profile name…"
          />
          <input
            type="text"
            value={windowClasses}
            onChange={e => setWindowClasses(e.target.value)}
            placeholder="Window classes (comma separated) e.g. firefox, code"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !newName.trim()}>
            Save Current
          </button>
        </div>

        {/* List */}
        <div className="profile-list">
          {loading && <p>Loading…</p>}
          {!loading && profiles.length === 0 && <p className="hint">No saved profiles</p>}
          {profiles.map(p => (
            <div key={p.id} className="profile-item">
              <div className="profile-item-info">
                <strong>{p.name}</strong>
                <span className="profile-meta">
                  DPI: {p.dpi || '—'} · {p.buttons.length} buttons
                  <br />
                  Apps: {p.windowClasses?.length ? p.windowClasses.join(', ') : 'Any'}
                </span>
              </div>
              <div className="profile-item-actions">
                <button className="btn btn-small" onClick={() => { onLoadProfile(p); setOpen(false); }}>
                  Load
                </button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(p.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}
