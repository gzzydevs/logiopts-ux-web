import { useEffect, useRef, useState } from 'react';

// Browser KeyboardEvent.code → Linux key name
const BROWSER_TO_LINUX: Record<string, string> = {
  KeyA: 'KEY_A', KeyB: 'KEY_B', KeyC: 'KEY_C', KeyD: 'KEY_D',
  KeyE: 'KEY_E', KeyF: 'KEY_F', KeyG: 'KEY_G', KeyH: 'KEY_H',
  KeyI: 'KEY_I', KeyJ: 'KEY_J', KeyK: 'KEY_K', KeyL: 'KEY_L',
  KeyM: 'KEY_M', KeyN: 'KEY_N', KeyO: 'KEY_O', KeyP: 'KEY_P',
  KeyQ: 'KEY_Q', KeyR: 'KEY_R', KeyS: 'KEY_S', KeyT: 'KEY_T',
  KeyU: 'KEY_U', KeyV: 'KEY_V', KeyW: 'KEY_W', KeyX: 'KEY_X',
  KeyY: 'KEY_Y', KeyZ: 'KEY_Z',
  Digit0: 'KEY_0', Digit1: 'KEY_1', Digit2: 'KEY_2', Digit3: 'KEY_3',
  Digit4: 'KEY_4', Digit5: 'KEY_5', Digit6: 'KEY_6', Digit7: 'KEY_7',
  Digit8: 'KEY_8', Digit9: 'KEY_9',
  ControlLeft: 'KEY_LEFTCTRL', ControlRight: 'KEY_RIGHTCTRL',
  ShiftLeft: 'KEY_LEFTSHIFT', ShiftRight: 'KEY_RIGHTSHIFT',
  AltLeft: 'KEY_LEFTALT', AltRight: 'KEY_RIGHTALT',
  MetaLeft: 'KEY_LEFTMETA', MetaRight: 'KEY_RIGHTMETA',
  F1: 'KEY_F1', F2: 'KEY_F2', F3: 'KEY_F3', F4: 'KEY_F4',
  F5: 'KEY_F5', F6: 'KEY_F6', F7: 'KEY_F7', F8: 'KEY_F8',
  F9: 'KEY_F9', F10: 'KEY_F10', F11: 'KEY_F11', F12: 'KEY_F12',
  Escape: 'KEY_ESC', Tab: 'KEY_TAB', Enter: 'KEY_ENTER',
  Space: 'KEY_SPACE', Backspace: 'KEY_BACKSPACE', Delete: 'KEY_DELETE',
  ArrowUp: 'KEY_UP', ArrowDown: 'KEY_DOWN',
  ArrowLeft: 'KEY_LEFT', ArrowRight: 'KEY_RIGHT',
  Home: 'KEY_HOME', End: 'KEY_END',
  PageUp: 'KEY_PAGEUP', PageDown: 'KEY_PAGEDOWN',
  Insert: 'KEY_INSERT', PrintScreen: 'KEY_SYSRQ',
  Minus: 'KEY_MINUS', Equal: 'KEY_EQUAL',
  BracketLeft: 'KEY_LEFTBRACE', BracketRight: 'KEY_RIGHTBRACE',
  Backslash: 'KEY_BACKSLASH', Semicolon: 'KEY_SEMICOLON',
  Quote: 'KEY_APOSTROPHE', Backquote: 'KEY_GRAVE',
  Comma: 'KEY_COMMA', Period: 'KEY_DOT', Slash: 'KEY_SLASH',
};

const KEY_DISPLAY: Record<string, string> = {
  KEY_LEFTCTRL: 'Ctrl', KEY_RIGHTCTRL: 'Ctrl',
  KEY_LEFTSHIFT: 'Shift', KEY_RIGHTSHIFT: 'Shift',
  KEY_LEFTALT: 'Alt', KEY_RIGHTALT: 'Alt',
  KEY_LEFTMETA: 'Super', KEY_RIGHTMETA: 'Super',
  KEY_ESC: 'Esc', KEY_TAB: 'Tab', KEY_ENTER: 'Enter',
  KEY_SPACE: 'Space', KEY_BACKSPACE: 'Bksp', KEY_DELETE: 'Del',
  KEY_UP: '↑', KEY_DOWN: '↓', KEY_LEFT: '←', KEY_RIGHT: '→',
  KEY_PAGEUP: 'PgUp', KEY_PAGEDOWN: 'PgDn',
};

function displayKey(k: string) {
  return KEY_DISPLAY[k] ?? k.replace('KEY_', '');
}

interface KeyCaptureProps {
  keys: string[];
  onChange: (keys: string[]) => void;
}

export default function KeyCapture({ keys, onChange }: KeyCaptureProps) {
  const [recording, setRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef(false);
  recordingRef.current = recording;

  useEffect(() => {
    if (!recording) return;

    const pressed = new Set<string>();
    let committed = false;

    const onDown = (e: KeyboardEvent) => {
      // Block ALL browser behavior: Tab focus, Ctrl+PgDn tab switch, etc.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const linux = BROWSER_TO_LINUX[e.code];
      if (linux && !pressed.has(linux)) {
        pressed.add(linux);
        setCurrentKeys(new Set(pressed));
      }
      return false;
    };

    const onUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (committed || pressed.size === 0) return false;
      committed = true;

      // Order: modifiers first, then other keys
      const modifiers = ['KEY_LEFTCTRL', 'KEY_RIGHTCTRL', 'KEY_LEFTSHIFT', 'KEY_RIGHTSHIFT',
        'KEY_LEFTALT', 'KEY_RIGHTALT', 'KEY_LEFTMETA', 'KEY_RIGHTMETA'];
      const sorted = [...pressed].sort((a, b) => {
        const aM = modifiers.includes(a) ? 0 : 1;
        const bM = modifiers.includes(b) ? 0 : 1;
        return aM - bM;
      });
      onChange(sorted);
      setRecording(false);
      setCurrentKeys(new Set());
      return false;
    };

    // Block focus changes while recording (prevents Tab from moving focus)
    const onFocusOut = (e: FocusEvent) => {
      if (recordingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.focus();
      }
    };

    // Capture phase (true) = intercept before browser handles them
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('focusout', onFocusOut, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('focusout', onFocusOut, true);
    };
  }, [recording, onChange]);

  const displayKeys = recording ? [...currentKeys] : keys;

  return (
    <div className="key-capture">
      <div
        ref={inputRef}
        className={`key-capture-input ${recording ? 'recording' : ''}`}
        tabIndex={0}
        onClick={() => { setRecording(true); inputRef.current?.focus(); }}
        onBlur={() => {
          if (!recordingRef.current) {
            setRecording(false);
            setCurrentKeys(new Set());
          }
        }}
      >
        {recording
          ? (displayKeys.length > 0
            ? displayKeys.map(displayKey).join(' + ')
            : '⌨ Press keys...')
          : (keys.length > 0
            ? keys.map(displayKey).join(' + ')
            : 'Click to record shortcut')
        }
      </div>
      {keys.length > 0 && !recording && (
        <div className="key-tags">
          {keys.map((k) => (
            <span key={k} className="key-tag">{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
