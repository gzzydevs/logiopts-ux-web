import { detectSolaar } from './solaarDetector';
import { jsonToSolaarYaml } from '../solaar/index';
import { buttonConfigsToProfileConfig } from '../state/bridge';
import { runScript } from './scriptRunner';
import type { Profile } from '../types';

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

