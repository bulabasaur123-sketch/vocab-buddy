'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { StorageService } = require('../services/storage');
const { SCHEMA_VERSION } = require('../db/sqliteSchema');
const { LibraryStore } = require('../store/libraryStore');
const { starterWords: seedWords } = require('../db/seed');
const starterWords = (...args) => seedWords(...args).map(word => ({ ...word, isFavorite: false, collections: [], tags: [] }));
function directory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-sqlite-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
function storage(t, dir = directory(t), autoSeed = false) {
  const service = new StorageService(dir, autoSeed); t.after(() => service.close()); return service;
}
function words() {
  return ['stymie', 'eke', 'beauty'].map((name, i) => {
    const word = starterWords(new Date('2026-11-02T00:00:00Z'))[0];
    return { ...word, id: name + '_' + i, word: name, displayWord: name[0].toUpperCase() + name.slice(1),
      inflectedForm: ['stymied', 'eking', 'beauties'][i], audioLocalPath: `${name}.mp3`, audioSizeBytes: 22528,
      meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: "Reader's 雪", example: 'A quotation: "test"' }] }] };
  });
}
function legacy(dir, entries) {
  const file = path.join(dir, 'vocab_library.json');
  fs.writeFileSync(file, JSON.stringify({ version: '1.0', updatedAt: new Date().toISOString(), words: entries }));
  return file;
}
test('SQLite schema, WAL, normal sync, indexes and close/reopen round trip', t => {
  const dir = directory(t); const db = storage(t, dir); const entries = words();
  db.saveWords(entries);
  assert.equal(path.basename(db.filePath), 'vocab_buddy.db');
  assert.equal(db.db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(db.db.prepare('PRAGMA synchronous').get().synchronous, 1);
  const indexes = db.db.prepare("PRAGMA index_list('words')").all().map(row => row.name);
  for (const name of ['idx_words_due', 'idx_words_box', 'idx_words_word', 'idx_words_inflected']) assert.ok(indexes.includes(name));
  assert.deepEqual(db.exportData(), entries); db.close(); db.close();
  assert.deepEqual(storage(t, dir).loadWords(), entries);
});
test('Migrates three exact JSON models once and preserves legacy backup bytes', t => {
  const dir = directory(t); const entries = words(); const file = legacy(dir, entries);
  const bytes = fs.readFileSync(file); const db = storage(t, dir, true);
  assert.deepEqual(db.loadWords(), entries);
  assert.equal(fs.existsSync(file), false); assert.deepEqual(fs.readFileSync(file + '.migrated'), bytes);
  db.saveWords([]); db.close();
  assert.deepEqual(storage(t, dir, true).loadWords(), []);
});
test('An empty legacy library remains empty; absent optional fields and labels get compatible defaults', t => {
  const dir = directory(t); legacy(dir, []);
  assert.deepEqual(storage(t, dir, true).loadWords(), []);
  const db = storage(t); const word = words()[0];
  delete word.review.boxLabel; delete word.review.intervalDays; delete word.audioLocalPath; delete word.audioSizeBytes; delete word.inflectedForm;
  db.addWord(word); const loaded = db.loadWords()[0];
  assert.equal(loaded.review.boxLabel, 'Daily'); assert.equal(loaded.review.intervalDays, 1);
  assert.equal(Object.hasOwn(loaded, 'audioLocalPath'), false);
});
test('Point insert and delete preserve other rows; duplicates and SQL injection are rejected or stored as data', t => {
  const db = storage(t); const store = new LibraryStore(db); const [first, second] = words();
  store.addWord(first); store.addWord(second);
  assert.throws(() => store.addWord({ ...first, id: 'new-id' }), /Word already saved/);
  assert.throws(() => store.addWord({ ...second, word: 'other' }));
  const attack = { ...words()[2], id: "x'); DROP TABLE words; --", bookSource: "Robert'); DELETE FROM words; --" };
  store.addWord(attack); assert.deepEqual(db.loadWords(), [first, second, attack]);
  store.removeWord(attack.id); assert.deepEqual(db.loadWords(), [first, second]);
  store.removeWord('unknown'); assert.deepEqual(db.loadWords(), [first, second]);
});
test('Review updates exactly one row and only review fields; full-table rewrite would trigger an abort', t => {
  const db = storage(t); const store = new LibraryStore(db); const entries = words(); db.saveWords(entries);
  db.db.exec(`CREATE TRIGGER reject_delete BEFORE DELETE ON words BEGIN SELECT RAISE(ABORT, 'no deletes'); END;
    CREATE TRIGGER reject_insert BEFORE INSERT ON words BEGIN SELECT RAISE(ABORT, 'no inserts'); END;
    CREATE TRIGGER reject_other_update BEFORE UPDATE ON words WHEN OLD.id != 'stymie_0' BEGIN SELECT RAISE(ABORT, 'wrong row'); END;`);
  const now = new Date('2026-11-03T00:00:00Z'); store.reviewWord(entries[0].id, 'good', now);
  const loaded = db.loadWords(); assert.deepEqual(loaded.slice(1), entries.slice(1));
  const { review, ...rest } = loaded[0]; const { review: previous, ...original } = entries[0];
  assert.deepEqual(rest, original); assert.equal(review.box, 2); assert.equal(review.boxLabel, '3 Days');
  assert.equal(review.nextReviewDate, '2026-11-06T00:00:00.000Z');
  assert.equal(review.reviewCount, previous.reviewCount + 1);
  assert.throws(() => store.reviewWord('missing', 'good'), /Word not found/);
  assert.throws(() => store.reviewWord(entries[0].id, 'bogus'));
  assert.deepEqual(db.loadWords(), loaded);
});
test('Failed import rolls back deletions and partial inserts; failed review remains unchanged', t => {
  const db = storage(t); const entries = words(); db.saveWords(entries);
  const conflicting = { ...entries[1], word: entries[0].word };
  assert.throws(() => db.importData([entries[0], conflicting])); assert.deepEqual(db.loadWords(), entries);
  assert.throws(() => db.importData([{ ...entries[0], audioSizeBytes: 102401 }]));
  db.db.exec("CREATE TRIGGER reject_review BEFORE UPDATE ON words BEGIN SELECT RAISE(ABORT, 'disk write rejected'); END;");
  assert.throws(() => db.reviewWord(entries[0].id, 'good'), /disk write rejected/);
  assert.deepEqual(db.loadWords(), entries);
});
test('Failed migration rolls back all rows and preserves original JSON for retry', t => {
  const dir = directory(t); const entries = words(); entries[1].word = entries[0].word;
  const file = legacy(dir, entries); const bytes = fs.readFileSync(file);
  assert.throws(() => new StorageService(dir, false)); assert.deepEqual(fs.readFileSync(file), bytes);
  const probe = new DatabaseSync(path.join(dir, 'vocab_buddy.db'));
  assert.equal(probe.prepare('PRAGMA user_version').get().user_version, 0); probe.close();
  legacy(dir, words()); assert.deepEqual(storage(t, dir).loadWords(), words());
});
test('Post-commit rename failure retries without reimporting or losing committed rows', t => {
  const dir = directory(t); const file = legacy(dir, words());
  const mock = t.mock.method(fs, 'renameSync', () => { throw new Error('rename denied'); });
  assert.throws(() => new StorageService(dir), /rename denied/); mock.mock.restore();
  const probe = new DatabaseSync(path.join(dir, 'vocab_buddy.db'));
  assert.equal(probe.prepare('SELECT COUNT(*) AS n FROM words').get().n, 3); probe.close();
  assert.equal(fs.existsSync(file), true);
  assert.deepEqual(storage(t, dir).loadWords(), words()); assert.equal(fs.existsSync(file + '.migrated'), true);
});
test('Interrupted rename completion and existing backups preserve both migration safety and user data', t => {
  const dir = directory(t); const file = legacy(dir, words()); fs.writeFileSync(file + '.migrated', 'older backup');
  assert.throws(() => new StorageService(dir), /backup already exists/);
  assert.equal(fs.readFileSync(file + '.migrated', 'utf8'), 'older backup');
  fs.unlinkSync(file + '.migrated'); fs.renameSync(file, file + '.migrated');
  assert.deepEqual(storage(t, dir).loadWords(), words());
});
test('Multiple store instances see committed mutations and do not overwrite stale snapshots', t => {
  const dir = directory(t); const a = new LibraryStore(storage(t, dir)); const b = new LibraryStore(storage(t, dir));
  const entries = words(); a.addWord(entries[0]); b.addWord(entries[1]);
  a.reviewWord(entries[0].id, 'good'); b.reviewWord(entries[0].id, 'good');
  assert.equal(a.getWords()[0].review.reviewCount, 2); assert.equal(a.getWords().length, 2);
  const copy = a.getWords(); copy[0].word = 'changed'; assert.equal(a.getWords()[0].word, entries[0].word);
});
test('Future database versions and corrupt database files fail without JSON fallback or replacement', t => {
  const dir = directory(t); const db = new DatabaseSync(path.join(dir, 'vocab_buddy.db'));
  db.exec('PRAGMA user_version = 99'); db.close();
  assert.throws(() => new StorageService(dir), /Unsupported database schema version/);
  const broken = directory(t); const file = path.join(broken, 'vocab_buddy.db'); fs.writeFileSync(file, 'broken sqlite');
  assert.throws(() => new StorageService(broken)); assert.equal(fs.readFileSync(file, 'utf8'), 'broken sqlite');
});
test('schema_meta records the current version and version-one databases retain words and migration markers', t => {
  const dir = directory(t); const entries = words(); const original = storage(t, dir);
  original.saveWords(entries);
  // Reconstruct the committed version-one layout from before sqliteSchema.js.
  original.db.exec(`DROP INDEX idx_words_due_timestamp;
    ALTER TABLE words DROP COLUMN next_review_at;
    ALTER TABLE schema_meta RENAME TO persistence_meta;
    DELETE FROM persistence_meta;
    INSERT INTO persistence_meta VALUES ('legacy_rename_pending', '1');
    PRAGMA user_version = 1;`);
  original.close(); const file = legacy(dir, entries);
  const upgraded = storage(t, dir);
  assert.deepEqual(upgraded.loadWords(), entries);
  assert.equal(upgraded.db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get().value, String(SCHEMA_VERSION));
  assert.equal(upgraded.db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
  assert.equal(upgraded.db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'persistence_meta'").get(), undefined);
  assert.equal(fs.existsSync(file + '.migrated'), true);
  assert.equal(upgraded.db.prepare("SELECT 1 FROM schema_meta WHERE key = 'legacy_rename_pending'").get(), undefined);
});
test('Indexed due queries order actual instants, preserve timestamp strings and do not load the whole library', t => {
  const db = storage(t); const entries = words();
  entries[0].review.nextReviewDate = '2026-11-02T10:00:00+08:00'; // 02:00 UTC
  entries[1].review.nextReviewDate = '2026-11-02T01:00:00.000Z';
  entries[2].review.nextReviewDate = '2026-11-02T03:00:00.000Z';
  db.saveWords(entries); const store = new LibraryStore(db);
  t.mock.method(db, 'loadWords', () => { throw new Error('full library read forbidden'); });
  const now = new Date('2026-11-02T02:00:00.000Z');
  assert.deepEqual(store.getDueWordsQueue(now), [entries[1], entries[0]]);
  assert.deepEqual(store.getReviewStats(now), { total: 3, due: 2, mastered: 0, learning: 3 });
  const plan = db.db.prepare('EXPLAIN QUERY PLAN SELECT * FROM words WHERE next_review_at <= ? ORDER BY next_review_at, rowid').all(now.getTime());
  assert.ok(plan.some(row => /SEARCH words USING INDEX idx_words_due_timestamp/.test(row.detail)));
  assert.throws(() => store.getDueWordsQueue(new Date('invalid')), /Invalid review date/);
  assert.throws(() => store.getReviewStats(new Date('invalid')), /Invalid review date/);
});
test('Targeted review updates queue index and database aggregate counts immediately', t => {
  const db = storage(t); const now = new Date('2026-11-02T00:00:00Z'); const entries = words();
  entries[1].review = { ...entries[1].review, box: 5, boxLabel: 'Mastered', intervalDays: 30 };
  db.saveWords(entries);
  assert.deepEqual(db.getReviewStats(now), { total: 3, due: 3, mastered: 1, learning: 2 });
  db.reviewWord(entries[0].id, 'good', now);
  assert.deepEqual(db.getDueWordsQueue(now).map(word => word.id), entries.slice(1).map(word => word.id));
  assert.equal(db.db.prepare('SELECT next_review_at FROM words WHERE id = ?').get(entries[0].id).next_review_at, Date.parse('2026-11-05T00:00:00Z'));
  db.saveWords([]);
  assert.deepEqual(db.getReviewStats(now), { total: 0, due: 0, mastered: 0, learning: 0 });
});
