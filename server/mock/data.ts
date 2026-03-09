/**
 * Mock data for cloud/CI development mode.
 *
 * Provides a fully-configured MX Master 3 device with buttons, profiles, and
 * scripts so the UI renders in 'connected' state without Solaar or real hardware.
 *
 * Used by server/mock/routes.ts when MOCK_MODE=true.
 */

import type { KnownDevice, KnownButton, Profile, ButtonConfig } from '../types';
import type { Script } from '../db/repositories/script.repo';
import { SYSTEM_ACTIONS } from '../services/deviceDatabase';

export { SYSTEM_ACTIONS as MOCK_SYSTEM_ACTIONS };

// ─── Device ──────────────────────────────────────────────────────────────────

export const MOCK_DEVICE_ID = 'mock-unit-mx-master-3';

export const MOCK_DEVICE: KnownDevice = {
    displayName: 'MX Master 3 (Mock)',
    solaarName: 'MX Master 3',
    unitId: MOCK_DEVICE_ID,
    pid: 0x4082,
    maxDpi: 4000,
    minDpi: 200,
    dpiStep: 50,
    svgId: 'mx-master-3',
    battery: 75,
    buttons: [
        { cid: 80,  name: 'Left Click',    solaarName: 'Left Button',          divertable: false, rawXy: false, reprogrammable: false, position: 'left'        },
        { cid: 81,  name: 'Right Click',   solaarName: 'Right Button',         divertable: false, rawXy: false, reprogrammable: false, position: 'right'       },
        { cid: 82,  name: 'Middle Click',  solaarName: 'Middle Button',        divertable: true,  rawXy: false, reprogrammable: true,  position: 'middle'      },
        { cid: 83,  name: 'Back',          solaarName: 'Back Button',          divertable: true,  rawXy: false, reprogrammable: true,  position: 'back'        },
        { cid: 86,  name: 'Forward',       solaarName: 'Forward Button',       divertable: true,  rawXy: false, reprogrammable: true,  position: 'forward'     },
        { cid: 195, name: 'Smart Shift',   solaarName: 'Smart Shift',          divertable: true,  rawXy: true,  reprogrammable: true,  position: 'scrollMode'  },
        { cid: 215, name: 'Scroll Left',   solaarName: 'Scroll Left Button',   divertable: true,  rawXy: false, reprogrammable: true,  position: 'scrollLeft'  },
        { cid: 216, name: 'Scroll Right',  solaarName: 'Scroll Right Button',  divertable: true,  rawXy: false, reprogrammable: true,  position: 'scrollRight' },
        { cid: 253, name: 'DPI Switch',    solaarName: 'DPI Switch',           divertable: true,  rawXy: false, reprogrammable: true,  position: 'dpiSwitch'   },
    ] as KnownButton[],
};

// ─── Profiles ────────────────────────────────────────────────────────────────

export const MOCK_PROFILE_DEFAULT_ID = 'mock-profile-default';
export const MOCK_PROFILE_GAMING_ID = 'mock-profile-gaming';
export const MOCK_PROFILE_MEDIA_ID = 'mock-profile-media';

const now = new Date().toISOString();

function noneButton(cid: number): ButtonConfig {
    return {
        cid,
        gestureMode: false,
        gestures: {
            None:  { type: 'None' },
            Up:    { type: 'None' },
            Down:  { type: 'None' },
            Left:  { type: 'None' },
            Right: { type: 'None' },
        },
        simpleAction: { type: 'None' },
    };
}

export const MOCK_PROFILES: Profile[] = [
    {
        id: MOCK_PROFILE_DEFAULT_ID,
        name: 'Default',
        deviceName: MOCK_DEVICE_ID,
        dpi: 1000,
        buttons: [
            {
                cid: 82,
                gestureMode: false,
                gestures: { None: { type: 'None' }, Up: { type: 'None' }, Down: { type: 'None' }, Left: { type: 'None' }, Right: { type: 'None' } },
                simpleAction: { type: 'KeyPress', keys: ['Control_L', 'c'] },
            },
            noneButton(83),
            noneButton(86),
            noneButton(195),
            noneButton(215),
            noneButton(216),
            noneButton(253),
        ],
        windowClasses: [],
        createdAt: now,
        updatedAt: now,
    },
    {
        id: MOCK_PROFILE_GAMING_ID,
        name: 'Gaming',
        deviceName: MOCK_DEVICE_ID,
        dpi: 3200,
        buttons: [
            {
                cid: 82,
                gestureMode: false,
                gestures: { None: { type: 'None' }, Up: { type: 'None' }, Down: { type: 'None' }, Left: { type: 'None' }, Right: { type: 'None' } },
                simpleAction: { type: 'MouseClick', button: 'middle', count: 'click' },
            },
            noneButton(83),
            {
                cid: 86,
                gestureMode: false,
                gestures: { None: { type: 'None' }, Up: { type: 'None' }, Down: { type: 'None' }, Left: { type: 'None' }, Right: { type: 'None' } },
                simpleAction: { type: 'KeyPress', keys: ['Control_L', 'z'] },
            },
            noneButton(195),
            noneButton(215),
            noneButton(216),
            noneButton(253),
        ],
        windowClasses: ['steam', 'Steam'],
        createdAt: now,
        updatedAt: now,
    },
    {
        id: MOCK_PROFILE_MEDIA_ID,
        name: 'Media',
        deviceName: MOCK_DEVICE_ID,
        dpi: 800,
        buttons: [
            noneButton(82),
            noneButton(83),
            noneButton(86),
            {
                cid: 195,
                gestureMode: true,
                gestures: {
                    None:  { type: 'KeyPress', keys: ['XF86_AudioPlay'] },
                    Up:    { type: 'KeyPress', keys: ['XF86_AudioRaiseVolume'] },
                    Down:  { type: 'KeyPress', keys: ['XF86_AudioLowerVolume'] },
                    Left:  { type: 'KeyPress', keys: ['XF86_AudioPrev'] },
                    Right: { type: 'KeyPress', keys: ['XF86_AudioNext'] },
                },
                simpleAction: { type: 'None' },
            },
            noneButton(215),
            noneButton(216),
            noneButton(253),
        ],
        windowClasses: ['vlc', 'spotify', 'Spotify'],
        createdAt: now,
        updatedAt: now,
    },
];

// ─── Scripts ─────────────────────────────────────────────────────────────────

export const MOCK_SCRIPTS: Script[] = [
    {
        id: 'mock-script-volume',
        name: 'volume.sh',
        path: 'scripts/volume.sh',
        content: '#!/bin/bash\n# Volume control\n# Usage: volume.sh [up|down|mute]\npamixer --$1 5 2>/dev/null || echo "Volume: $1"',
        executable: true,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'mock-script-brightness',
        name: 'brightness.sh',
        path: 'scripts/brightness.sh',
        content: '#!/bin/bash\n# Brightness control\n# Usage: brightness.sh [up|down]\necho "Brightness: $1"',
        executable: true,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'mock-script-nightshift',
        name: 'nightshift.sh',
        path: 'scripts/nightshift.sh',
        content: '#!/bin/bash\n# Night shift / Blue light filter\nredshift -O 4000K 2>/dev/null || echo "Night mode toggled"',
        executable: true,
        createdAt: now,
        updatedAt: now,
    },
];
