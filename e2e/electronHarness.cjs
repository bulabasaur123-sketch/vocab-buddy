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
// Inject at the network boundary so production service construction stays intact.
globalThis.fetch = async input => {
  const url = new URL(input);
  if (url.hostname === 'en.wiktionary.org') return Response.json({ parse: { text: { '*': '<h2>English</h2><h3>Etymology</h3><p>From Serendip, coined by Horace Walpole.</p>' } } });
  if (url.pathname.endsWith('.mp3')) {
    // A valid short PCM recording; MIME sniffing serves WAV despite the cache filename.
    const bytes = Buffer.alloc(444);
    bytes.write('RIFF'); bytes.writeUInt32LE(436, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28);
    bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36); bytes.writeUInt32LE(400, 40);
    return new Response(bytes);
  }
  const word = decodeURIComponent(url.pathname.split('/').pop());
  if (word === 'missingword') return new Response('', { status: 404 });
  if (['stymied', 'eking'].includes(word)) return Response.json([{ phonetics: [], meanings: [] }]);
  return Response.json([{ phonetic: '/fixture/', phonetics: [{ audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/' + word + '-us.mp3' }], meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: `Definition for ${word}`, example: 'A fixture sentence.' }], synonyms: ['chance'] }] }]);
};
require('../main');
