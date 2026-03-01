/**
 * Generates logid.cfg in libconfig format from our JSON model.
 */
import type { LogidConfig, DeviceConfig, ButtonConfig, Action, GestureConfig } from '../types.js';

export function generateLogidCfg(config: LogidConfig): string {
  const lines: string[] = [];
  lines.push('devices: (');
  const devStrings = config.devices.map((device) => serializeDevice(device, '  '));
  lines.push(devStrings.join(',\n'));
  lines.push(');');
  return lines.join('\n') + '\n';
}

function serializeDevice(dev: DeviceConfig, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}{`);
  const i2 = indent + '  ';

  lines.push(`${i2}name: "${dev.name}";`);

  if (dev.dpi !== undefined) {
    lines.push(`${i2}dpi: ${dev.dpi};`);
  }

  if (dev.smartshift) {
    lines.push(`${i2}smartshift: {`);
    if (dev.smartshift.on !== undefined) lines.push(`${i2}  on: ${dev.smartshift.on};`);
    if (dev.smartshift.threshold !== undefined) lines.push(`${i2}  threshold: ${dev.smartshift.threshold};`);
    if (dev.smartshift.defaultThreshold !== undefined) lines.push(`${i2}  default_threshold: ${dev.smartshift.defaultThreshold};`);
    lines.push(`${i2}};`);
  }

  if (dev.hiresscroll) {
    lines.push(`${i2}hiresscroll: {`);
    if (dev.hiresscroll.hires !== undefined) lines.push(`${i2}  hires: ${dev.hiresscroll.hires};`);
    if (dev.hiresscroll.invert !== undefined) lines.push(`${i2}  invert: ${dev.hiresscroll.invert};`);
    if (dev.hiresscroll.target !== undefined) lines.push(`${i2}  target: ${dev.hiresscroll.target};`);
    lines.push(`${i2}};`);
  }

  if (dev.buttons.length > 0) {
    lines.push(`${i2}buttons: (`);
    const btnStrings = dev.buttons.map((btn) => serializeButton(btn, i2 + '  '));
    lines.push(btnStrings.join(',\n'));
    lines.push(`${i2});`);
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function serializeButton(btn: ButtonConfig, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}{`);
  const i2 = indent + '  ';
  lines.push(`${i2}cid: 0x${btn.cid.toString(16).padStart(4, '0')};`);
  const actionStr = serializeAction(btn.action, i2);
  lines.push(`${i2}action: ${actionStr};`);
  lines.push(`${indent}}`);
  return lines.join('\n');
}

function serializeAction(action: Action, indent: string): string {
  switch (action.type) {
    case 'None':
      return '{ type: "None"; }';

    case 'Keypress': {
      const keys = action.keys.map((k) => `"${k}"`).join(', ');
      return `{ type: "Keypress"; keys: [${keys}]; }`;
    }

    case 'Gestures': {
      const lines: string[] = [];
      const i2 = indent + '  ';
      lines.push('{');
      lines.push(`${i2}type: "Gestures";`);
      lines.push(`${i2}gestures: (`);
      const gestureStrings = action.gestures.map((g) => serializeGesture(g, i2 + '  '));
      lines.push(gestureStrings.join(',\n'));
      lines.push(`${i2});`);
      lines.push(`${indent}}`);
      return lines.join('\n');
    }

    case 'ToggleSmartShift':
      return '{ type: "ToggleSmartShift"; }';

    case 'ToggleHiresScroll':
      return '{ type: "ToggleHiresScroll"; }';

    case 'CycleDPI': {
      const dpis = action.dpis.join(', ');
      return `{ type: "CycleDPI"; dpis: [${dpis}]; }`;
    }

    case 'ChangeDPI':
      return `{ type: "ChangeDPI"; inc: ${action.inc}; }`;

    case 'ChangeHost':
      if (typeof action.host === 'number') {
        return `{ type: "ChangeHost"; host: ${action.host}; }`;
      }
      return `{ type: "ChangeHost"; host: "${action.host}"; }`;

    default:
      return '{ type: "None"; }';
  }
}

function serializeGesture(gesture: GestureConfig, indent: string): string {
  const lines: string[] = [];
  const i2 = indent + '  ';
  lines.push(`${indent}{`);
  lines.push(`${i2}direction: "${gesture.direction}";`);

  const mode = gesture.mode ?? 'OnRelease';
  lines.push(`${i2}mode: "${mode}";`);

  if ((mode === 'OnThreshold' || mode === 'OnInterval' || mode === 'OnFewPixels') && gesture.threshold !== undefined) {
    lines.push(`${i2}threshold: ${gesture.threshold};`);
  }

  const actionStr = serializeAction(gesture.action, i2);
  lines.push(`${i2}action: ${actionStr};`);
  lines.push(`${indent}}`);
  return lines.join('\n');
}
