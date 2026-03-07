import { useEffect, useRef, useCallback } from 'react';

/**
 * Browser keyboard code → X11 keysym mapping.
 * Kept client-side so the key capture modal works offline.
 */
const BROWSER_TO_X11: Record<string, string> = {
  KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e',
  KeyF: 'f', KeyG: 'g', KeyH: 'h', KeyI: 'i', KeyJ: 'j',
  KeyK: 'k', KeyL: 'l', KeyM: 'm', KeyN: 'n', KeyO: 'o',
  KeyP: 'p', KeyQ: 'q', KeyR: 'r', KeyS: 's', KeyT: 't',
  KeyU: 'u', KeyV: 'v', KeyW: 'w', KeyX: 'x', KeyY: 'y', KeyZ: 'z',
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  ShiftLeft: 'Shift_L', ShiftRight: 'Shift_R',
  ControlLeft: 'Control_L', ControlRight: 'Control_R',
  AltLeft: 'Alt_L', AltRight: 'Alt_R',
  MetaLeft: 'Super_L', MetaRight: 'Super_R',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'Page_Up', PageDown: 'Page_Down',
  Insert: 'Insert', Delete: 'Delete',
  Backspace: 'BackSpace', Tab: 'Tab', Enter: 'Return', Escape: 'Escape',
  Space: 'space',
  Comma: 'comma', Period: 'period', Slash: 'slash', Backslash: 'backslash',
  BracketLeft: 'bracketleft', BracketRight: 'bracketright',
  Semicolon: 'semicolon', Quote: 'apostrophe', Backquote: 'grave',
  Minus: 'minus', Equal: 'equal',
};

const DISPLAY_NAMES: Record<string, string> = {
  Control_L: 'Ctrl', Control_R: 'Ctrl', Shift_L: 'Shift', Shift_R: 'Shift',
  Alt_L: 'Alt', Alt_R: 'Alt', Super_L: 'Super', Super_R: 'Super',
  Return: 'Enter', BackSpace: 'Backspace', space: 'Space', Escape: 'Esc',
  Page_Up: 'PgUp', Page_Down: 'PgDn',
  Up: '↑', Down: '↓', Left: '←', Right: '→', Tab: 'Tab',
};

export function displayKeysym(keysym: string): string {
  return DISPLAY_NAMES[keysym] || keysym.replace(/_/g, ' ');
}

/** Modifiers come first, non-modifiers last */
function sortKeys(keys: string[]): string[] {
  const mods = ['Control_L', 'Control_R', 'Shift_L', 'Shift_R', 'Alt_L', 'Alt_R', 'Super_L', 'Super_R'];
  const modKeys = keys.filter(k => mods.includes(k));
  const rest = keys.filter(k => !mods.includes(k));
  return [...modKeys, ...rest];
}

interface KeyCaptureProps {
  open: boolean;
  currentKeys: string[];
  onConfirm: (keys: string[]) => void;
  onCancel: () => void;
}

export default function KeyCapture({ open, currentKeys, onConfirm, onCancel }: KeyCaptureProps) {
  const keysRef = useRef<Set<string>>(new Set());
  const displayRef = useRef<HTMLDivElement>(null);

  const updateDisplay = useCallback(() => {
    if (displayRef.current) {
      const keys = sortKeys([...keysRef.current]);
      displayRef.current.textContent = keys.length
        ? keys.map(displayKeysym).join(' + ')
        : 'Press keys…';
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    keysRef.current = new Set();
    updateDisplay();

    const onDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        onCancel();
        return;
      }

      const sym = BROWSER_TO_X11[e.code];
      if (sym && !keysRef.current.has(sym)) {
        keysRef.current.add(sym);
        updateDisplay();
      }
    };

    const onUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // On first key release, confirm the combo
      if (keysRef.current.size > 0) {
        const result = sortKeys([...keysRef.current]);
        onConfirm(result);
      }
    };

    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, [open, onConfirm, onCancel, updateDisplay]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal key-capture">
        <h3>Press a Key Combination</h3>
        <div ref={displayRef} className="key-display">Press keys…</div>
        <p className="hint">
          Hold modifier keys (Ctrl, Shift, Alt, Super) then press a regular key.
          Release to confirm. Press Escape to cancel.
        </p>
        {currentKeys.length > 0 && (
          <p className="current">
            Current: <strong>{currentKeys.map(displayKeysym).join(' + ')}</strong>
          </p>
        )}
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
