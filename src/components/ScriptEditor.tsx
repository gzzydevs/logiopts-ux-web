import { useRef, useEffect, useState } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Script } from '../types';
import './ScriptEditor.css';

const DEFAULT_SCRIPT = `#!/usr/bin/env bash
# Script creado desde LogiTux
set -euo pipefail

echo "Hello from LogiTux script!"
`;

interface ScriptEditorProps {
  script?: Script;
  onClose: () => void;
  onSave: (data: { name: string; content: string; executable: boolean }) => void;
}

export default function ScriptEditor({ script, onClose, onSave }: ScriptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [name, setName] = useState(script?.name || '');
  const [executable, setExecutable] = useState(script?.executable ?? true);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: script?.content || DEFAULT_SCRIPT,
      extensions: [
        lineNumbers(),
        StreamLanguage.define(shell),
        oneDark,
        EditorView.theme({
          '&': { height: '300px', fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    viewRef.current = view;

    return () => view.destroy();
  }, []);

  function handleSave() {
    const content = viewRef.current?.state.doc.toString() || '';
    let finalName = name.trim();
    if (!finalName) return;
    if (!finalName.endsWith('.sh')) finalName += '.sh';
    onSave({ name: finalName, content, executable });
  }

  async function handleTest() {
    if (!script?.id) {
      setTestOutput('Guarda el script primero para poder testearlo.');
      return;
    }
    setTesting(true);
    setTestOutput(null);
    try {
      const res = await fetch(`/api/scripts/${script.id}/test`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setTestOutput(`[exit ${json.data.exitCode}]\n${json.data.output}`);
      } else {
        setTestOutput(`Error: ${json.error}`);
      }
    } catch (err) {
      setTestOutput(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="script-editor-overlay" onClick={onClose}>
      <div className="script-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="script-editor-header">
          <h3>{script ? 'Editar Script' : 'Nuevo Script'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="script-editor-body">
          <label className="script-field">
            <span>Nombre</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="mi-script.sh"
            />
          </label>

          <div className="script-editor-cm" ref={editorRef} />

          <label className="script-checkbox">
            <input
              type="checkbox"
              checked={executable}
              onChange={e => setExecutable(e.target.checked)}
            />
            <span>Ejecutable (chmod +x)</span>
          </label>

          {testOutput !== null && (
            <pre className="script-test-output">{testOutput}</pre>
          )}
        </div>

        <div className="script-editor-footer">
          <button
            className="btn btn-secondary"
            onClick={handleTest}
            disabled={testing || !script?.id}
          >
            {testing ? '⏳ Ejecutando…' : '▶ Test'}
          </button>
          <div className="script-editor-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
