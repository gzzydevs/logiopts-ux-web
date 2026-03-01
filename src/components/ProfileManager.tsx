import { useState, useEffect } from 'react';
import type { Profile, ButtonConfig } from '../types';
import { getProfiles, saveProfile, deleteProfile } from '../hooks/useApi';

interface ProfileManagerProps {
  deviceName: string;
  dpi: number;
  buttons: ButtonConfig[];
  onLoad: (profile: Profile) => void;
}

export default function ProfileManager({ deviceName, dpi, buttons, onLoad }: ProfileManagerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState('');

  const refresh = () => { getProfiles().then(setProfiles).catch(console.error); };
  useEffect(refresh, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    const profile: Profile = {
      id: '',
      name: name.trim(),
      deviceLogidName: deviceName,
      dpi,
      buttons,
      createdAt: '',
      updatedAt: '',
    };
    await saveProfile(profile);
    setName('');
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteProfile(id);
    refresh();
  };

  return (
    <div className="profiles card">
      <h3>Profiles</h3>
      <div className="profile-save">
        <input
          type="text"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Profile name"
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button className="btn-primary" onClick={handleSave}>Save</button>
      </div>
      <div className="profile-list">
        {profiles.map((p) => (
          <div key={p.id} className="profile-item">
            <span className="profile-name" onClick={() => onLoad(p)}>{p.name}</span>
            <button className="btn-danger" onClick={() => handleDelete(p.id)}>×</button>
          </div>
        ))}
        {profiles.length === 0 && <p className="hint">No profiles saved yet</p>}
      </div>
    </div>
  );
}
