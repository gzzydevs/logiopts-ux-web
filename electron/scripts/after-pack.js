/**
 * electron-builder after-pack hook.
 *
 * Runs after the app contents are packed but before the installer is created.
 * Can be used to adjust permissions or copy extra files.
 */

exports.default = async function afterPack(context) {
  console.log('[after-pack] Pack completed for', context.targets.map(t => t.name).join(', '));
};
