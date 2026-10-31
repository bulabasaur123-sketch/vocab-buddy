'use strict';
// Only this test entry point redirects storage and replaces outbound HTTP.
const { app, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dataDir = path.resolve(process.env.VOCAB_E2E_DATA_DIR || '');
if (!dataDir.startsWith(`${os.tmpdir()}${path.sep}`)) throw new Error('E2E requires isolated temporary storage');
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);
// Headless windows have no visible desktop surface; keep animation-frame based
// Playwright actionability checks running even when Chromium considers it occluded.
app.on('browser-window-created', (_event, window) => {
  window.webContents.setBackgroundThrottling(false);
});
app.whenReady().then(() => {
  // Avoid the native Save dialog in headless mode; still exercise the real download.
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSavePath(path.join(dataDir, path.basename(item.getFilename())));
  });
});
const dictionary = require('../src/services/dictionary');
const fixtureDictionary = dictionary.createDictionaryService(async input => {
  const url = new URL(input);
  if (url.hostname === 'en.wiktionary.org') return { ok: true, json: async () => ({ parse: { text: { '*': '<h2>English</h2><h3>Etymology</h3><p>From Serendip, coined by Horace Walpole.</p>' } } }) };
  const word = decodeURIComponent(url.pathname.split('/').pop());
  if (word === 'missingword') return { ok: false, status: 404 };
  return { ok: true, json: async () => [{ phonetic: '/fixture/', phonetics: [{ audio: 'https://audio.example/word-us.mp3' }], meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: `Definition for ${word}`, example: 'A fixture sentence.' }], synonyms: ['chance'] }] }] };
});
dictionary.lookupWord = fixtureDictionary.lookupWord;
require('../main');
