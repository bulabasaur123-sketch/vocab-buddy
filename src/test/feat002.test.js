'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AudioStorageService } = require('../services/audioStorage');
const { createDictionaryService, resolveRootLemma } = require('../services/dictionary');
const { BOX_METRICS, initialReview, calculateNextReview } = require('../services/spacedRepetition');
const { validateWords } = require('../db/wordSchema');
const { registerHandlers, createBackendServices } = require('../services/ipc');
function directory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feat002-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const audioUrl = 'https://api.dictionaryapi.dev/media/pronunciations/en/stymie-us.mp3';
for (const [query, root] of [['stymied', 'stymie'], ['eking', 'eke'], ['beauties', 'beauty']]) {
  test(`${query} resolves and inherits canonical pronunciation, meanings and cached audio`, async t => {
    const audio = new AudioStorageService(directory(t), async () => new Response(Buffer.concat([Buffer.from('ID3'),Buffer.alloc(22525, 1)])));
    const dictionary = createDictionaryService(async url => {
      if (url.includes('wiktionary.org')) return Response.json({});
      const word = decodeURIComponent(url.split('/').pop());
      return Response.json([{ phonetics: word === root ? [{ text: '/root/', audio: audioUrl }] : [], meanings: [] }]);
    }, audio);
    const result = await dictionary.lookupWord(query, 'Book');
    assert.equal(result.word, root); assert.equal(result.inflectedForm, query);
    assert.equal(result.displayWord, root[0].toUpperCase() + root.slice(1));
    assert.equal(result.phonetic, '/root/'); assert.equal(result.audioUrl, audioUrl);
    assert.equal(result.audioLocalPath, `${root}.mp3`); assert.equal(result.audioSizeBytes, 22528);
    assert.equal(result.bookSource, 'Book'); validateWords([result]);
  });
}
test('Lemma evidence, English scope and suffix safeguards', () => {
  assert.equal(resolveRootLemma('stymied', []), 'stymie');
  assert.equal(resolveRootLemma('eking', []), 'eke');
  assert.equal(resolveRootLemma('went', [], '<span class="form-of-definition-link"><a>go</a></span>'), 'go');
  assert.equal(resolveRootLemma('went', [{ sourceUrls: ['https://en.wiktionary.org/wiki/go'] }]), 'go');
  assert.equal(resolveRootLemma('news', [{ phonetic: '/news/' }]), null);
  assert.equal(resolveRootLemma('word', [], '<h2>German</h2><span class="form-of-definition-link"><a>wrong</a></span><h2>English</h2><p>word</p>'), null);
});
test('Missing inflection entry resolves via wiki; cycles terminate', async () => {
  let calls = 0;
  const dictionary = createDictionaryService(async url => {
    calls++;
    if (url.includes('wiktionary')) return Response.json({ parse: { text: { '*': '<span class="form-of-definition-link"><a>go</a></span>' } } });
    return url.endsWith('/went') ? new Response('', { status: 404 }) : Response.json([{ meanings: [] }]);
  });
  assert.equal((await dictionary.lookupWord('went')).word, 'go');
  assert.equal(calls, 4);
});
test('Wikimedia Ogg fallback is cached and served with the correct MIME type', async t => {
  const services = createBackendServices(directory(t), async url => {
    if (url.includes('upload.wikimedia')) return new Response(Buffer.from('OggSrecording'));
    if (url.includes('wiktionary')) return Response.json({ parse: { text: { '*': '<audio><source src="//upload.wikimedia.org/wikipedia/commons/a/ab/en-us-word.ogg"></audio>' } } });
    return Response.json([{ meanings: [] }]);
  });
  const result = await services.dictionary.lookupWord('word'); validateWords([result]);
  assert.match(result.audioUrl, /\.ogg$/);
  const handlers = new Map();
  registerHandlers({ handle: (name, fn) => handlers.set(name, fn) }, {}, services.dictionary, frame => frame === 'trusted', services.audio);
  assert.throws(() => handlers.get('vocab:audio')({ senderFrame: 'bad' }, 'word'), /Untrusted/);
  assert.match(handlers.get('vocab:audio')({ senderFrame: 'trusted' }, 'word'), /^data:audio\/ogg;base64,/);
  assert.equal(services.audio.getAudioDataUrl('../secrets'), null);
});
test('Cache downloads once, survives restart and enforces per-call size caps', async t => {
  let requests = 0; const dir = directory(t);
  const audio = new AudioStorageService(dir, async () => { requests++; return new Response(Buffer.concat([Buffer.from('ID3'),Buffer.alloc(22525)])); });
  const results = await Promise.all([audio.cacheAudio('word', audioUrl), audio.cacheAudio('word', audioUrl)]);
  assert.deepEqual(results[0], { localPath: 'word.mp3', sizeBytes: 22528 }); assert.equal(requests, 1);
  const restarted = new AudioStorageService(dir, async () => { throw new Error('offline'); });
  assert.deepEqual(await restarted.cacheAudio('word', audioUrl), results[0]);
  assert.equal(await restarted.cacheAudio('word', audioUrl, 10), null);
});
test('Rejects oversized declared and streamed bodies, empty downloads, failures and unsafe sources', async t => {
  const dir = directory(t);
  for (const response of [new Response(Buffer.alloc(102401)), new Response('a', { headers: { 'content-length': '102401' } }), new Response(''), new Response('', { status: 404 })]) {
    const audio = new AudioStorageService(dir, async () => response);
    assert.equal(await audio.cacheAudio('word', audioUrl), null);
    assert.deepEqual(fs.readdirSync(dir), []);
  }
  const audio = new AudioStorageService(dir, async () => { throw new Error('offline'); });
  assert.equal(await audio.cacheAudio('word', audioUrl), null);
  for (const url of ['http://127.0.0.1/a.mp3', 'file:///etc/passwd', 'https://evil.example/a.mp3']) assert.equal(await audio.cacheAudio('word', url), null);
  assert.equal(await audio.cacheAudio('../escape', audioUrl), null);
  assert.equal(await audio.cacheAudio('word', audioUrl, 102401), null);
});
test('All box labels and intervals follow the fixed cadence for every rating', () => {
  const now = new Date('2026-11-02T00:00:00Z');
  assert.equal(initialReview(now).boxLabel, 'Daily');
  for (let box = 1; box <= 5; box++) for (const rating of ['again', 'hard', 'good', 'easy']) {
    const result = calculateNextReview({ ...initialReview(now), box, intervalDays: 999 }, rating, now);
    const expected = rating === 'again' ? 1 : Math.min(5, box + (rating === 'easy' ? 2 : rating === 'good' ? 1 : 0));
    assert.equal(result.box, expected); assert.equal(result.boxLabel, BOX_METRICS[expected].label);
    assert.equal(result.intervalDays, BOX_METRICS[expected].intervalDays);
    assert.equal(Date.parse(result.nextReviewDate) - now.getTime(), result.intervalDays * 86400000);
  }
});
test('Legacy saved reviews gain labels without changing their due dates', t => {
  const { StorageService } = require('../services/storage');
  const { starterWords } = require('../db/seed');
  const words = starterWords(); delete words[0].review.boxLabel;
  const storage = new StorageService(directory(t), false);
  storage.saveWords(words);
  const loaded = storage.loadWords()[0];
  assert.equal(loaded.review.boxLabel, 'Daily');
  assert.equal(loaded.review.nextReviewDate, words[0].review.nextReviewDate);
});
