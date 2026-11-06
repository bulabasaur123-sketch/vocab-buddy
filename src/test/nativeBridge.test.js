'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { spawn } = require('node:child_process');
const { StorageService } = require('../services/storage');
const { starterWords } = require('../db/seed');
const { MAX_MESSAGE_BYTES, encodeMessage, runBridge, createCaptureHandler } = require('../services/nativeBridge');
const payload = (overrides = {}) => ({ version: 1, id: 'cap_1', word: ' Ephemeral ', sentenceExcerpt: 'A fleeting moment.', sourceTitle: 'Essay', sourceUrl: 'https://example.com/essay', capturedAt: '2026-11-06T00:00:00.000Z', ...overrides });
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
function decode(buffer) {
  const results = [];
  while (buffer.length) { const n = buffer.readUInt32LE(); assert.ok(n <= MAX_MESSAGE_BYTES); results.push(JSON.parse(buffer.subarray(4, 4 + n))); buffer = buffer.subarray(4 + n); }
  return results;
}
async function transport(chunks, handler = async value => value) {
  const input = new PassThrough(); const output = new PassThrough(); const received = [];
  output.on('data', chunk => received.push(chunk));
  const done = runBridge(input, output, handler);
  for (const chunk of chunks) input.write(chunk);
  input.end(); await done; return decode(Buffer.concat(received));
}
test('framing encodes UTF-8 byte lengths and handles split headers, bodies and multiple frames in order', async () => {
  const frame = encodeMessage({ word: 'été' }); assert.equal(frame.readUInt32LE(), Buffer.byteLength(JSON.stringify({ word: 'été' })));
  const combined = Buffer.concat([frame, encodeMessage({ word: 'second' })]);
  assert.deepEqual(await transport([...combined].map(byte => Buffer.from([byte]))), [{ word: 'été' }, { word: 'second' }]);
});
test('rejects oversized/zero headers, malformed JSON/UTF8 and truncated EOF', async () => {
  for (const n of [0, MAX_MESSAGE_BYTES + 1, 0xffffffff]) {
    const header = Buffer.alloc(4); header.writeUInt32LE(n);
    assert.equal((await transport([header]))[0].code, 'INVALID_PAYLOAD');
  }
  for (const buffer of [Buffer.from([1, 0]), Buffer.from([2, 0, 0, 0, 123]), Buffer.from([1, 0, 0, 0, 255]), Buffer.from([1, 0, 0, 0, 123])]) assert.equal((await transport([buffer]))[0].code, 'INVALID_PAYLOAD');
  assert.deepEqual(await transport([]), []);
});
test('new capture is enriched with headword only, sanitized and persisted; duplicate/replay preserves review and metadata', async t => {
  const dir = temporary(t); const storage = new StorageService(dir, false); t.after(() => storage.close());
  const calls = []; const base = { ...starterWords()[0], word: 'ephemeral', displayWord: 'Ephemeral' };
  const handle = createCaptureHandler(storage, { lookupWord: async (...args) => { calls.push(args); return base; } });
  const first = await handle(payload({ sentenceExcerpt: '<b>Moment</b>\u0000.', tags: ['web'] }));
  assert.equal(first.status, 'success'); assert.equal(first.isDuplicate, false); assert.deepEqual(calls, [['ephemeral']]);
  assert.equal(storage.selectOne(first.wordId).review.box, 1);
  storage.reviewWord(first.wordId, 'easy'); storage.reviewWord(first.wordId, 'good');
  const before = storage.selectOne(first.wordId);
  const duplicate = await handle(payload({ id: 'cap_2', notes: 'Reader note' }));
  assert.equal(duplicate.existingBox, 4); assert.equal(duplicate.isDuplicate, true);
  assert.deepEqual(storage.selectOne(first.wordId), before);
  await handle(payload({ id: 'cap_2' }));
  assert.equal(storage.getReadingEncounters(first.wordId).length, 2);
  assert.equal(storage.getReadingEncounters(first.wordId)[0].sentenceExcerpt, 'Moment.');
  assert.equal(calls.length, 1);
  storage.saveWords(storage.loadWords());
  assert.equal(storage.getReadingEncounters(first.wordId).length, 2);
  storage.close(); const reopened = new StorageService(dir, false); t.after(() => reopened.close());
  assert.equal(reopened.getReadingEncounters(first.wordId)[1].notes, 'Reader note');
  assert.deepEqual(reopened.selectOne(first.wordId).review, before.review);
});
test('invalid captures never enrich or write; enrichment/storage failures have actionable codes', async t => {
  const storage = new StorageService(temporary(t), false); t.after(() => storage.close()); let calls = 0;
  const handle = createCaptureHandler(storage, { lookupWord: async () => { calls++; throw new Error('offline'); } });
  for (const invalid of [null, {}, payload({ version: 2 }), payload({ word: ' ' }), payload({ sentenceExcerpt: 'x'.repeat(301) }), payload({ sourceTitle: 'x'.repeat(201) }), payload({ sourceUrl: 'javascript:alert(1)' }), payload({ capturedAt: 'yesterday' }), payload({ tags: [3] }), payload({ notes: {} })]) assert.equal((await handle(invalid)).code, 'INVALID_PAYLOAD');
  assert.equal(calls, 0); assert.equal(storage.getWords().length, 0);
  assert.equal((await handle(payload())).code, 'ENRICHMENT_FAILED');
  storage.close(); assert.equal((await handle(payload())).code, 'DB_UNAVAILABLE');
});
test('concurrent captures resolve to one word and invalid shelf rolls back all writes', async t => {
  const storage = new StorageService(temporary(t), false); t.after(() => storage.close());
  const base = { ...starterWords()[0], word: 'ephemeral' };
  const handler = createCaptureHandler(storage, { lookupWord: async () => { await new Promise(resolve => setImmediate(resolve)); return base; } });
  const responses = await Promise.all([handler(payload()), handler(payload({ id: 'cap_2' }))]);
  assert.deepEqual(responses.map(item => item.isDuplicate), [false, true]); assert.equal(storage.getWords().length, 1);
  assert.equal((await handler(payload({ id: 'cap_3', shelfId: 'missing' }))).code, 'INVALID_PAYLOAD');
  assert.equal(storage.getReadingEncounters(base.id).length, 2);
});
test('CLI exits cleanly on closed stdin and returns framed errors without stdout noise', async t => {
  const dir = temporary(t);
  for (const input of [Buffer.alloc(0), encodeMessage({ version: 2 })]) {
    const child = spawn(process.execPath, [path.join(__dirname, '../services/nativeBridge.js')], { env: { ...process.env, WORDLOOM_STORAGE_DIR: dir }, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let stderr = ''; child.stdout.on('data', chunk => chunks.push(chunk)); child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdin.end(input);
    const timer = setTimeout(() => child.kill(), 5000);
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }); clearTimeout(timer);
    assert.equal(code, 0, stderr);
    const responses = decode(Buffer.concat(chunks)); assert.equal(responses.length, input.length ? 1 : 0);
    if (input.length) assert.equal(responses[0].code, 'INVALID_PAYLOAD');
  }
});
