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
    console.log(`[Macro] handleMacroKey called: key=${macroKey} activeClass=${activeClass ?? 'none'}`);
    const { getAllProfiles } = await import('../routes/profiles.js');
    const { getActiveProfileId } = await import('../state/memory-store.js');
    const profiles = await getAllProfiles();

    // Use the actual active profile from memory-store, not a hardcoded "default" lookup
    const activeId = getActiveProfileId();
    let activeProfile = activeId ? profiles.find(p => p.id === activeId) : null;

    // Fallback: window-class match, then default
    if (!activeProfile && activeClass) {
        activeProfile = profiles.find(p => p.windowClasses?.includes(activeClass)) ?? null;
    }
    if (!activeProfile) {
        activeProfile = profiles.find(p => p.id === 'default' || p.name.toLowerCase() === 'default') ?? null;
    }

    console.log(`[Macro] active profile: ${activeProfile?.name ?? '(none)'}`);
    if (!activeProfile) return;

    const { emitStoreEvent } = await import('../state/memory-store.js');

    // Search for RunScript matching this macro key
    let found = false;
    for (const btn of activeProfile.buttons) {
        if (btn.gestureMode) {
            for (const dir in btn.gestures) {
                const action = btn.gestures[dir as keyof typeof btn.gestures];
                console.log(`[Macro]   button gesture ${dir}: type=${action.type} macroKey=${(action as any).macroKey ?? '-'}`);
                if (action.type === 'RunScript' && action.macroKey === macroKey) {
                    found = true;
                    console.log(`[Macro] ✓ Match! Running script ${action.scriptId} from gesture ${dir}`);
                    runScriptById(action.scriptId).catch(e => {
                        console.error(e);
                        emitStoreEvent({ type: 'script-error', payload: { message: e.message } });
                    });
                    return;
                }
            }
        } else {
            const sa = btn.simpleAction;
            console.log(`[Macro]   button simple: type=${sa?.type ?? '-'} macroKey=${(sa as any)?.macroKey ?? '-'}`);
            if (sa?.type === 'RunScript' && sa.macroKey === macroKey) {
                found = true;
                console.log(`[Macro] ✓ Match! Running script ${sa.scriptId} from button`);
                runScriptById(sa.scriptId).catch(e => {
                    console.error(e);
                    emitStoreEvent({ type: 'script-error', payload: { message: e.message } });
                });
                return;
            }
        }
    }
    if (!found) {
        console.warn(`[Macro] ✗ No RunScript action found for macroKey=${macroKey} in profile "${activeProfile.name}"`);
    }
}
