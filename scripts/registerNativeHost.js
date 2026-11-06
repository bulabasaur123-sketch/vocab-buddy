#!/usr/bin/env node
'use strict';

/**
 * Wordloom Native Messaging Host Registration Helper
 * Configures com.wordloom.bridge.json for Chrome / Chromium / Brave / Edge.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function getHostDirectories() {
  const home = os.homedir();
  if (process.platform === 'linux') {
    return [
      path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
      path.join(home, '.config', 'chromium', 'NativeMessagingHosts'),
      path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
      path.join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts')
    ];
  }
  if (process.platform === 'darwin') {
    return [
      path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
      path.join(home, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts')
    ];
  }
  return [];
}

function registerHost(extensionId) {
  const bridgeScript = path.resolve(__dirname, '../src/services/nativeBridge.js');
  // Make sure bridge script is executable
  try {
    fs.chmodSync(bridgeScript, 0o755);
  } catch {
    // Non-fatal
  }

  // Create a launcher script or wrapper if direct node invocation is needed
  const manifest = {
    name: 'com.wordloom.bridge',
    description: 'Wordloom Desktop Native Messaging Bridge',
    path: bridgeScript,
    type: 'stdio',
    allowed_origins: extensionId ? [`chrome-extension://${extensionId}/`] : ['chrome-extension://*/*']
  };

  const targetDirs = getHostDirectories();
  let installedCount = 0;

  for (const dir of targetDirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const targetFile = path.join(dir, 'com.wordloom.bridge.json');
      fs.writeFileSync(targetFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      console.log(`Registered native host in: ${targetFile}`);
      installedCount++;
    } catch (err) {
      // Skip directories that cannot be created
    }
  }

  console.log(`Native host registered across ${installedCount} browser profile locations.`);
}

const extId = process.argv[2] || '';
registerHost(extId);

