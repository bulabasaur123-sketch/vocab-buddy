'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { AudioStorageService } = require('../services/audioStorage');
test('Cache rejects traversal, symlink reads and untrusted origins; permits the exact byte ceiling', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-security-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let requests = 0;
  const cache = new AudioStorageService(path.join(dir, 'audio'), async (_url, options) => {
    requests++; assert.equal(options.redirect, 'error');
    return new Response(Buffer.alloc(102400));
  });
  fs.writeFileSync(path.join(dir, 'private'), 'private');
  fs.symlinkSync(path.join(dir, 'private'), path.join(dir, 'audio', 'linked.mp3'));
  for (const input of ['../private', '/etc/passwd', '..\\private', '', null, {}, 'linked']) assert.equal(cache.getAudioDataUrl(input), null);
  for (const url of ['https://api.dictionaryapi.dev.evil.test/a.mp3', 'https://user:pass@api.dictionaryapi.dev/a.mp3', 'https://api.dictionaryapi.dev:8443/a.mp3', 'http://api.dictionaryapi.dev/a.mp3']) assert.equal(await cache.cacheAudio('word', url), null);
  assert.equal(requests, 0);
  assert.deepEqual(await cache.cacheAudio('word', 'https://api.dictionaryapi.dev/a.mp3'), { localPath: 'word.mp3', sizeBytes: 102400 });
  assert.equal(fs.statSync(cache.getLocalAudioPath('word')).size, 102400);
});
