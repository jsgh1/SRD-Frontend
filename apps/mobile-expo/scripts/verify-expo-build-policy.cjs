const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');

const cli = require.resolve('expo/bin/cli');
const projectDirectory = path.resolve(__dirname, '..');

function cleartextSetting(qaBuild) {
  const env = {...process.env};
  delete env.SRD_EXPO_QA_BUILD;
  delete env.EXPO_PUBLIC_SRD_QA_ONLY;
  if (qaBuild) {
    env.SRD_EXPO_QA_BUILD = '1';
    env.EXPO_PUBLIC_SRD_QA_ONLY = '1';
  }
  const result = spawnSync(process.execPath, [cli, 'config', '--type', 'prebuild', '--json'], {
    cwd: projectDirectory,
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || 'Expo config command failed');
  const config = JSON.parse(result.stdout);
  const buildProperties = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  assert.ok(buildProperties, 'expo-build-properties plugin is missing');
  return buildProperties[1]?.android?.usesCleartextTraffic;
}

assert.equal(cleartextSetting(false), false, 'normal Expo builds must disallow cleartext traffic');
assert.equal(cleartextSetting(true), true, 'QA Expo builds must enable local Gateway traffic');
console.log('PASS: Android cleartext is disabled by default and enabled only for guarded QA builds.');
