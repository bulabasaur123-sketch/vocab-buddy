#!/usr/bin/env node
'use strict';

/**
 * Wordloom Native Messaging Host Registration Helper
 * Configures com.wordloom.bridge.json for Chrome / Chromium / Brave / Edge.
 * Strictly enforces an explicit 32-character Chrome extension ID (letters a-p).
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

function registerHost(rawExtensionId) {
  const extensionId = (rawExtensionId || '').trim().toLowerCase();

  // Chrome extension IDs are strictly 32 characters in length using base16 chars a-p.
  // Wildcards are rejected by Chrome for native messaging hosts.
  if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) {
    console.error('Error: An explicit 32-character Chrome extension ID (letters a–p) is required.');
    console.error('Usage: node scripts/registerNativeHost.js <32-char-extension-id>');
    console.error('Example: node scripts/registerNativeHost.js knkghkmobmclocjkggnllcfgnckjdmph');
    process.exit(1);
  }

  const bridgeScript = path.resolve(__dirname, '../src/services/nativeBridge.js');
  try {
    fs.chmodSync(bridgeScript, 0o755);
  } catch {
    // Non-fatal if filesystem does not support chmod
  }

  const manifest = {
    name: 'com.wordloom.bridge',
    description: 'Wordloom Desktop Native Messaging Bridge',
    path: bridgeScript,
    type: 'stdio',
    allowed_origins: [
      `chrome-extension://${extensionId}/`
    ]
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
    } catch {
      // Skip directories that cannot be created or accessed
    }
  }

  if (installedCount === 0) {
    console.error('Error: Could not register native host in any browser profile directory.');
    process.exit(1);
  }

  console.log(`Native host registered across ${installedCount} browser profile locations for extension: ${extensionId}`);
}

if (require.main === module) {
  registerHost(process.argv[2]);
}

module.exports = { registerHost, getHostDirectories };
