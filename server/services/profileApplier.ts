import { detectSolaar } from './solaarDetector.js';
import { jsonToSolaarYaml } from '../solaar/index.js';
import { buttonConfigsToProfileConfig } from '../state/bridge.js';
import { runScript, runScriptById } from './scriptRunner.js';
import type { Profile } from '../types.js';

export async function applyProfileToSolaar(profile: Profile): Promise<boolean> {
    const status = await detectSolaar();
    if (!status.installed || !status.configDir) {
        console.error('Solaar not found');
        return false;
    }

    // Build divert-keys CSV for the shell script (e.g. "83:2,86:2,253:2")
    const divertPairs: string[] = [];
    for (const btn of profile.buttons) {
        if (btn.gestureMode) {
            divertPairs.push(`${btn.cid}:2`);
        } else if (btn.simpleAction && btn.simpleAction.type !== 'None') {
            divertPairs.push(`${btn.cid}:1`);
        } else {
            divertPairs.push(`${btn.cid}:0`);
        }
    }
    const divertKeysCsv = divertPairs.join(',');

    // Use new parser for rules.yaml (correct format with button names)
    const profileConfig = buttonConfigsToProfileConfig(
        profile.buttons,
        profile.deviceName,
        profile.name,
    );
    const rulesYaml = jsonToSolaarYaml(profileConfig);

    try {
        await runScript(
            'apply-solaar.sh',
            [status.installType, status.configDir, divertKeysCsv],
            rulesYaml,
        );
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
                    console.log(`[Macro] Running script ${action.scriptId} from gesture ${dir}`);
                    runScriptById(action.scriptId).catch(e => console.error(e));
                    return;
                }
            }
        } else if (btn.simpleAction?.type === 'RunScript' && btn.simpleAction.macroKey === macroKey) {
            console.log(`[Macro] Running script ${btn.simpleAction.scriptId} from button`);
            runScriptById(btn.simpleAction.scriptId).catch(e => console.error(e));
            return;
        }
    }
}
