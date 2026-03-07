import { jsonToSolaarYaml } from './server/solaar/parser';
import { ButtonConfig } from './server/types';
import { buttonConfigsToProfileConfig } from './server/state/bridge';

const buttons: ButtonConfig[] = [
    {
        cid: 86,
        gestureMode: true,
        gestures: {
            None: { type: 'None' },
            Up: { type: 'None' },
            Down: { type: 'Execute', command: ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', '-5%'] },
            Left: { type: 'None' },
            Right: { type: 'None' }
        },
        simpleAction: { type: 'None' }
    }
];

const profileConfig = buttonConfigsToProfileConfig(buttons, 'DEVICE123', 'Default');
try {
    const yamlStr = jsonToSolaarYaml(profileConfig);
    console.log("SUCCESS:");
    console.log(yamlStr);
} catch (err) {
    console.error("ERROR:");
    console.error(err);
}
