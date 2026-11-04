'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { initialReview, calculateNextReview, getDueWordsQueue, getReviewStats, isDueForReview } = require('../services/spacedRepetition');
const { StorageService } = require('../services/storage');
const { LibraryStore } = require('../store/libraryStore');
const { starterWords: seedWords } = require('../db/seed');
const starterWords = (...args) => seedWords(...args).map(word => ({ ...word, isFavorite: false, collections: [], tags: [] }));
const { registerHandlers } = require('../services/ipc');
const now = new Date('2026-10-31T12:00:00.000Z');
function temporary(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
for (const [rating, box, days, streak] of [['again', 1, 1, 0], ['hard', 1, 1, 1], ['good', 2, 3, 1], ['easy', 3, 7, 1]]) {
  test(`Box 1 ${rating} schedules ${days} days`, () => {
    const previous = initialReview(now);
    const next = calculateNextReview(previous, rating, now);
    assert.equal(next.box, box); assert.equal(next.streak, streak); assert.equal(next.intervalDays, days);
    assert.equal(next.nextReviewDate, new Date(now.getTime() + days * 86400000).toISOString());
    assert.equal(next.reviewCount, 1); assert.equal(next.lastRating, rating); assert.equal(next.lastReviewedAt, now.toISOString());
    assert.equal(previous.reviewCount, 0);
  });
}
test('Box 4 again resets streak; easy caps box; hard retains box cadence', () => {
  const previous = { ...initialReview(now), box: 4, streak: 4, intervalDays: 10 };
  assert.equal(calculateNextReview(previous, 'again', now).streak, 0);
  assert.equal(calculateNextReview(previous, 'again', now).box, 1);
  assert.equal(calculateNextReview(previous, 'easy', now).box, 5);
  assert.equal(calculateNextReview(previous, 'easy', now).intervalDays, 30);
  assert.equal(calculateNextReview(previous, 'hard', now).intervalDays, 14);
  assert.throws(() => calculateNextReview(previous, 'bogus', now));
  assert.throws(() => calculateNextReview({ box: 6 }, 'good', now));
});
test('Due queue includes boundary, sorts oldest first, and preserves input', () => {
  const a = starterWords(now)[0]; const b = structuredClone(a); b.id = 'b'; b.review.box = 5; b.review.boxLabel = 'Mastered'; b.review.nextReviewDate = '2026-10-30T00:00:00Z';
  const c = structuredClone(a); c.id = 'c'; c.review.nextReviewDate = '2026-11-01T00:00:00Z';
  const words = [a, b, c]; assert.deepEqual(getDueWordsQueue(words, now).map(word => word.id), ['b', a.id]);
  assert.equal(words[0], a); assert.equal(isDueForReview(c, now), false);
  assert.deepEqual(getReviewStats(words, now), { total: 3, due: 2, mastered: 1, learning: 2 });
  assert.deepEqual(getReviewStats([], now), { total: 0, due: 0, mastered: 0, learning: 0 });
});
test('Storage creates nested directories, seeds once, persists payload and empty libraries', t => {
  const dir = path.join(temporary(t), 'nested'); const storage = new StorageService(dir);
  assert.equal(storage.loadWords().length, 1);
  const words = starterWords(now); words[0].bookSource = 'Dune'; assert.equal(storage.saveWords(words), true);
  assert.deepEqual(new StorageService(dir).loadWords(), words);
  assert.equal(storage.db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(storage.db.prepare('SELECT COUNT(*) AS n FROM words').get().n, 1);
  storage.saveWords([]); assert.deepEqual(new StorageService(dir).loadWords(), []);
});
test('Malformed legacy JSON is preserved and migration fails closed', t => {
  const dir = temporary(t); const file = path.join(dir, 'vocab_library.json'); fs.writeFileSync(file, '{broken');
  assert.throws(() => new StorageService(dir, false));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
test('Import/export validates before replacement and returns detached values', t => {
  const storage = new StorageService(temporary(t), false); const words = starterWords(now);
  assert.equal(storage.importData(words), true); const copy = storage.exportData(); copy[0].word = 'changed';
  assert.deepEqual(storage.loadWords(), words);
  for (const invalid of [null, {}, [{}], [...words, ...words], [{ ...words[0], audioUrl: 'javascript:alert(1)' }], [{ ...words[0], review: { ...words[0].review, box: 0 } }]]) assert.throws(() => storage.importData(invalid));
  assert.deepEqual(storage.loadWords(), words);
});
test('Store add, remove, review, duplicate rejection and restart persistence', t => {
  const storage = new StorageService(temporary(t), false); const store = new LibraryStore(storage); const word = starterWords(now)[0];
  store.addWord(word); assert.throws(() => store.addWord(word)); store.reviewWord(word.id, 'good', now);
  assert.equal(store.getWords()[0].review.box, 2); assert.equal(store.getReviewStats(now).due, 0); assert.deepEqual(store.getDueWordsQueue(now), []);
  assert.equal(new LibraryStore(storage).getWords()[0].review.reviewCount, 1);
  const copy = store.getWords(); copy.length = 0; assert.equal(store.getWords().length, 1);
  assert.throws(() => store.reviewWord('missing', 'good')); store.removeWord(word.id); assert.deepEqual(storage.loadWords(), []);
});
test('Failed persistence does not publish new store state', () => {
  const store = new LibraryStore({ loadWords: () => [], addWord: () => { throw new Error('disk full'); } });
  assert.throws(() => store.addWord(starterWords(now)[0]), /disk full/); assert.deepEqual(store.getWords(), []);
});
test('IPC checks sender for every channel and delegates storage/review/lookup', async t => {
  const handlers = new Map(); const store = new LibraryStore(new StorageService(temporary(t), false));
  registerHandlers({ handle: (name, fn) => handlers.set(name, fn) }, store, { lookupWord: async (word, book) => ({ word, book }) }, frame => frame === 'trusted');
  for (const fn of handlers.values()) assert.throws(() => fn({ senderFrame: 'remote' }), /Untrusted/);
  const event = { senderFrame: 'trusted' };
  assert.deepEqual(await handlers.get('vocab:lookup')(event, 'word', 'book'), { word: 'word', book: 'book' });
  assert.equal(handlers.get('vocab:save')(event, starterWords(now)), true);
  assert.equal(handlers.get('vocab:load')(event).length, 1);
  assert.equal(handlers.get('vocab:export')(event).length, 1);
  assert.equal(handlers.get('vocab:import')(event, []), true);
});
test('Preload exposes only named channel wrappers, never raw IPC', async () => {
  let api; const calls = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../preload.js'), 'utf8'), { require: name => {
    assert.equal(name, 'electron'); return { contextBridge: { exposeInMainWorld: (name, value) => { assert.equal(name, 'vocabAPI'); api = value; } }, ipcRenderer: { invoke: (...args) => calls.push(args) } };
  } });
  assert.equal(Object.keys(api).length, 23); api.lookupWord('test'); api.reviewWord('id', 'again');
  assert.deepEqual(calls, [['vocab:lookup', 'test', ''], ['vocab:review', 'id', 'again']]);
  assert.equal(api.invoke, undefined);
});
test('Failed SQL replacement preserves the previous library', t => {
  const storage = new StorageService(temporary(t));
  const original = storage.loadWords();
  const duplicate = { ...original[0], id: 'duplicate-id' };
  assert.throws(() => storage.saveWords([...original, duplicate]));
  assert.deepEqual(storage.loadWords(), original);
});
test('Electron initializes isolated windows, denies navigation, and wires lifecycle handlers', async () => {
  const events = new Map(); const windowEvents = new Map(); const webEvents = new Map(); let options; let loaded; let trusted;
  let quit = false; let windows = []; let created = 0;
  class BrowserWindow {
    constructor(config) {
      options = config; created++; windows.push(this);
      this.webContents = { mainFrame: { url: 'file:///app/index.html' }, setWindowOpenHandler: handler => { this.openHandler = handler; }, on: (name, handler) => webEvents.set(name, handler) };
    }
    on(name, handler) { windowEvents.set(name, handler); }
    loadFile(file) { loaded = file; return Promise.resolve(); }
    loadURL(url) { loaded = url; return Promise.resolve(); }
    static getAllWindows() { return windows; }
  }
  const permissions = {};
  const modules = {
    electron: { app: { whenReady: () => Promise.resolve(), on: (name, fn) => events.set(name, fn), getPath: () => '/fake/userData', quit: () => { quit = true; } }, BrowserWindow, ipcMain: {}, session: { defaultSession: { setPermissionRequestHandler: fn => { permissions.request = fn; }, setPermissionCheckHandler: fn => { permissions.check = fn; } } } },
    'node:path': path, 'node:fs': { existsSync: () => true }, 'node:url': require('node:url'),
    './src/services/storage': { StorageService: class {} }, './src/store/libraryStore': { LibraryStore: class {} },
    './src/services/dictionary': {}, './src/services/ipc': { createBackendServices: () => ({ dictionary: {}, audio: {} }), registerHandlers: (_ipc, _store, _dictionary, check) => { trusted = check; } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../main.js'), 'utf8'), { __dirname: '/app', require: name => { assert.ok(name in modules, name); return modules[name]; }, console, process: { platform: 'linux' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(loaded, '/app/index.html'); assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false); assert.equal(options.webPreferences.sandbox, true);
  assert.equal(trusted(windows[0].webContents.mainFrame), true); assert.equal(trusted({ url: 'file:///app/index.html' }), false);
  windows[0].webContents.mainFrame.url = 'https://evil.example'; assert.equal(trusted(windows[0].webContents.mainFrame), false);
  assert.equal(windows[0].openHandler().action, 'deny'); assert.equal(permissions.check(), false);
  let allowed; permissions.request(null, 'camera', value => { allowed = value; }); assert.equal(allowed, false);
  for (const name of ['will-navigate', 'will-attach-webview']) { let prevented = false; webEvents.get(name)({ preventDefault: () => { prevented = true; } }); assert.ok(prevented); }
  events.get('activate')(); assert.equal(created, 1);
  windowEvents.get('closed')(); windows = []; events.get('activate')(); assert.equal(created, 2);
  events.get('window-all-closed')(); assert.equal(quit, true);
});
