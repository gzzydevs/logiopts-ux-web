import { detectSolaar, hostReadFile } from './solaarDetector.js';
import { generateConfigYaml } from './configGenerator.js';
import { jsonToSolaarYaml } from '../solaar/index.js';
import { buttonConfigsToProfileConfig } from '../state/bridge.js';
import { runScript } from './scriptRunner.js';
import type { SolaarConfig, Profile } from '../types.js';

export async function applyProfileToSolaar(profile: Profile): Promise<boolean> {
    const divertKeys: Record<number, 0 | 1 | 2> = {};

    for (const btn of profile.buttons) {
        if (btn.gestureMode) {
            divertKeys[btn.cid] = 2;
        } else if (btn.simpleAction && btn.simpleAction.type !== 'None') {
            divertKeys[btn.cid] = 1;
        } else {
            divertKeys[btn.cid] = 0;
        }
    }

    const solaarConfig: SolaarConfig = {
        deviceName: profile.deviceName,
        unitId: profile.deviceName, // generateConfigYaml accepts deviceName as fallback
        dpi: profile.dpi || 1000,
        divertKeys,
        rules: []
    };

    const status = await detectSolaar();
    if (!status.installed || !status.configDir) {
        console.error('Solaar not found');
        return false;
    }

    let existingConfig = '';
    try {
        existingConfig = await hostReadFile(`${status.configDir}/config.yaml`);
    } catch {
        // Ignore error
    }

    const configYaml = generateConfigYaml(existingConfig, solaarConfig);

    // Use new parser for rules.yaml (correct format with button names)
    const profileConfig = buttonConfigsToProfileConfig(
        profile.buttons,
        profile.deviceName,
        profile.name,
    );
    const rulesYaml = jsonToSolaarYaml(profileConfig);

    const stdin = `${configYaml}\n---RULES---\n${rulesYaml}`;
    try {
        await runScript('apply-solaar.sh', [status.installType, status.configDir], stdin);
        console.log(`Applied profile: ${profile.name}`);
        return true;
    } catch (error) {
        console.error('Failed to apply Solaar profile', error);
        return false;
    }
}

export async function handleMacroKey(macroKey: string, activeClass: string | null) {
    const { getAllProfiles } = await import('../routes/profiles.js');
    const profiles = await getAllProfiles();

    // Determine active profile
    let activeProfile = profiles.find(p => p.id === 'default' || p.name.toLowerCase() === 'default');
    if (activeClass) {
        const appProfile = profiles.find(p => p.windowClasses?.includes(activeClass));
        if (appProfile) activeProfile = appProfile;
    }

    if (!activeProfile) return;

    // Search for RunScript matching this macro key
    for (const btn of activeProfile.buttons) {
        if (btn.gestureMode) {
            for (const dir in btn.gestures) {
                const action = btn.gestures[dir as keyof typeof btn.gestures];
                if (action.type === 'RunScript' && action.macroKey === macroKey) {
                    console.log(`[Macro] Running script ${action.script} from gesture ${dir}`);
                    runScript(action.script).catch(e => console.error(e));
                    return;
                }
            }
        } else if (btn.simpleAction?.type === 'RunScript' && btn.simpleAction.macroKey === macroKey) {
            console.log(`[Macro] Running script ${btn.simpleAction.script} from button`);
            runScript(btn.simpleAction.script).catch(e => console.error(e));
            return;
        }
    }
}
