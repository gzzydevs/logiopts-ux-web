import { useState, useEffect } from 'react';
import type { Script } from '../types';
import ScriptEditor from './ScriptEditor';
import {
  fetchScripts,
  createScript as apiCreateScript,
  updateScript as apiUpdateScript,
  deleteScript as apiDeleteScript,
} from '../hooks/useApi';
import './ScriptManager.css';

interface ScriptManagerProps {
  onScriptChange?: () => void;
}

export default function ScriptManager({ onScriptChange }: ScriptManagerProps) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [editing, setEditing] = useState<Script | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function loadScripts() {
    try {
      const data = await fetchScripts();
      setScripts(data);
    } catch (err) {
      console.error('Failed to load scripts:', err);
    }
  }

  useEffect(() => { loadScripts(); }, []);

  async function handleSave(data: { name: string; content: string; executable: boolean }) {
    try {
      if (editing === 'new') {
        await apiCreateScript(data);
      } else if (editing) {
        await apiUpdateScript(editing.id, data);
      }
      setEditing(null);
      await loadScripts();
      onScriptChange?.();
    } catch (err) {
      console.error('Failed to save script:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDeleteScript(id);
      setConfirmDelete(null);
      await loadScripts();
      onScriptChange?.();
    } catch (err) {
      console.error('Failed to delete script:', err);
    }
  }

  return (
    <div className="script-manager">
      <div className="script-manager-header">
        <h3>Scripts</h3>
        <button className="btn btn-small btn-primary" onClick={() => setEditing('new')}>
          + Nuevo Script
        </button>
      </div>

      <div className="script-list">
        {scripts.length === 0 && (
          <div className="script-empty">No hay scripts. Crea uno nuevo.</div>
        )}
        {scripts.map(s => (
          <div key={s.id} className="script-item">
            <div className="script-info">
              <span className="script-name">{s.name}</span>
              <span className={`script-exec-badge ${s.executable ? 'exec-yes' : 'exec-no'}`}>
                {s.executable ? '✓ ejecutable' : '✗ no ejecutable'}
              </span>
            </div>
            <div className="script-actions">
              <button className="btn btn-small btn-secondary" onClick={() => setEditing(s)}>
                ✏️ Editar
              </button>
              {confirmDelete === s.id ? (
                <>
                  <button className="btn btn-small btn-danger" onClick={() => handleDelete(s.id)}>
                    Confirmar
                  </button>
                  <button className="btn btn-small btn-secondary" onClick={() => setConfirmDelete(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button className="btn btn-small btn-secondary" onClick={() => setConfirmDelete(s.id)}>
                  🗑 Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ScriptEditor
          script={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
