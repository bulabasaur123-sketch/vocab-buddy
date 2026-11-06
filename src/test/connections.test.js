'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { StorageService } = require('../services/storage');
const { LibraryStore } = require('../store/libraryStore');
const { registerHandlers } = require('../services/ipc');
const { starterWords } = require('../db/seed');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'connections-'));
  const s = new StorageService(dir, false);
  t.after(() => { s.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  for (let i = 0; i < 15; i++) s.addWord({ ...starterWords()[0], id: `w_${i}`, word: `word${i}`, displayWord: `Word${i}`, bookSource: 'A Book' });
  return { s, dir };
}
test('v3 upgrade preserves data; failed v4 migration rolls back table, indexes and version', t => {
  const { s, dir } = fixture(t);
  const before = s.getWords();
  s.db.exec(`DROP TABLE word_associations; DROP INDEX idx_words_book_source;
    PRAGMA user_version = 3; UPDATE schema_meta SET value = '3' WHERE key = 'schema_version';
    CREATE TABLE idx_word_assoc_2 (broken TEXT);`);
  s.close();
  assert.throws(() => new StorageService(dir, false));
  const probe = new DatabaseSync(path.join(dir, 'vocab_buddy.db'));
  assert.equal(probe.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(probe.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get().value, '3');
  assert.equal(probe.prepare("SELECT 1 FROM sqlite_master WHERE name = 'word_associations'").get(), undefined);
  probe.exec('DROP TABLE idx_word_assoc_2'); probe.close();
  const upgraded = new StorageService(dir, false);
  try {
    assert.equal(upgraded.db.prepare('PRAGMA user_version').get().user_version, 5);
    assert.deepEqual(upgraded.getWords(), before);
    assert.equal(upgraded.db.prepare('PRAGMA foreign_key_list(word_associations)').all().length, 2);
    assert.ok(upgraded.db.prepare('PRAGMA index_list(word_associations)').all().length >= 3);
    upgraded.addAssociation('w_0', 'w_1');
    assert.throws(() => upgraded.db.prepare('INSERT INTO word_associations VALUES (?, ?, ?, ?)').run('w_1', 'w_0', '', 'now'), /CHECK/);
    assert.throws(() => upgraded.db.prepare('INSERT INTO word_associations VALUES (?, ?, ?, ?)').run('w_0', 'w_missing', '', 'now'), /FOREIGN KEY/);
  } finally { upgraded.close(); }
});
test('associations canonicalize, update notes, persist, retrieve both directions and cascade both endpoints', t => {
  const { s, dir } = fixture(t);
  assert.deepEqual(s.addAssociation('w_1', 'w_0', 'first'), { success: true, association: { wordId1: 'w_0', wordId2: 'w_1', note: 'first' } });
  const createdAt = s.getAssociationsForWord('w_0')[0].createdAt;
  s.addAssociation('w_0', 'w_1', 'updated');
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM word_associations').get().n, 1);
  assert.deepEqual(s.getAssociationsForWord('w_0'), [{ associatedWordId: 'w_1', displayWord: 'Word1', word: 'word1', note: 'updated', createdAt }]);
  assert.equal(s.getAssociationsForWord('w_1')[0].associatedWordId, 'w_0');
  const reopened = new StorageService(dir, false);
  try { assert.equal(reopened.getAssociationsForWord('w_0')[0].note, 'updated'); } finally { reopened.close(); }
  assert.deepEqual(s.removeAssociation('w_1', 'w_0'), { success: true });
  s.removeAssociation('w_0', 'w_1');
  s.addAssociation('w_0', 'w_1'); s.addAssociation('w_1', 'w_2');
  s.removeWord('w_1');
  assert.deepEqual(s.getAssociationsForWord('w_0'), []);
  assert.deepEqual(s.getAssociationsForWord('w_2'), []);
  assert.ok(s.selectOne('w_0')); assert.ok(s.selectOne('w_2'));
});
test('invalid IDs, self links, missing words, notes and unbounded limits fail cleanly', t => {
  const { s } = fixture(t);
  assert.throws(() => s.addAssociation('w_0', 'w_0'), /itself/);
  assert.throws(() => s.addAssociation('w_0', 'missing'), /not found/);
  assert.throws(() => s.addAssociation('w_0', 'w_1', {}), /note/);
  for (const id of [null, {}, 1, '', ' ', 'w_0\0']) {
    assert.throws(() => s.addAssociation(id, 'w_1'), /ID/);
    assert.throws(() => s.removeAssociation('w_0', id), /ID/);
    assert.throws(() => s.getAssociationsForWord(id), /ID/);
    assert.throws(() => s.getConnectionsNeighborhood(id), /ID/);
  }
  for (const limit of [-1, 101, Infinity, NaN, 1.5, '10', null]) assert.throws(() => s.getConnectionsNeighborhood('w_0', limit), /limit/);
  assert.throws(() => s.getConnectionsNeighborhood('missing'), /not found/);
  assert.throws(() => s.getAssociationsForWord('missing'), /not found/);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM word_associations').get().n, 0);
});
test('neighborhood includes center, source, tags, shelves and associations with bounded hub samples', t => {
  const { s } = fixture(t); const shelf = s.createCollection('My shelf');
  for (let i = 0; i < 15; i++) { s.setWordTags(`w_${i}`, ['theme']); s.assignWordToCollection(`w_${i}`, shelf.id); }
  s.addAssociation('w_0', 'w_1', 'related');
  for (const limit of [0, 2, 10]) {
    const graph = limit === 10 ? s.getConnectionsNeighborhood('w_0') : s.getConnectionsNeighborhood('w_0', limit);
    assert.equal(graph.centerId, 'w_0');
    assert.equal(graph.nodes.length, 5); assert.equal(graph.links.length, 4);
    assert.equal(new Set(graph.nodes.map(n => n.id)).size, 5);
    const center = graph.nodes[0]; assert.equal(center.label, 'Word0'); assert.deepEqual(center.review, s.selectOne('w_0').review);
    for (const type of ['source', 'tag', 'shelf']) {
      const hub = graph.nodes.find(n => n.type === type);
      assert.equal(hub.totalCount, 15); assert.equal(hub.data.memberCount, 15);
      assert.equal(hub.sampleWords.length, limit);
      assert.ok(graph.links.some(l => l.source === 'w_0' && l.target === hub.id && l.type === type));
    }
    assert.ok(graph.links.some(l => l.target === 'w_1' && l.type === 'association' && l.note === 'related'));
  }
  s.addWord({ ...starterWords()[0], id: 'isolated', word: 'isolated', bookSource: '  ' });
  assert.equal(s.getConnectionsNeighborhood('isolated').nodes.length, 1);
});
test('store, trusted IPC routes and preload expose all connections operations', t => {
  const { s } = fixture(t); const handlers = {};
  registerHandlers({ handle: (name, fn) => { handlers[name] = fn; } }, new LibraryStore(s), {}, frame => frame === 'trusted');
  let api;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../preload.js'), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
      ipcRenderer: { invoke: (name, ...args) => handlers[name]({ senderFrame: 'trusted' }, ...args) } })
  });
  for (const name of ['vocab:associations:add', 'vocab:associations:remove', 'vocab:associations:list', 'vocab:connections:neighborhood']) {
    assert.throws(() => handlers[name]({ senderFrame: 'evil' }, 'w_0', 'w_1'), /Untrusted/);
  }
  api.addAssociation('w_0', 'w_1', 'ipc');
  assert.equal(api.getAssociations('w_1')[0].note, 'ipc');
  assert.equal(api.getConnectionsNeighborhood('w_0', 1).centerId, 'w_0');
  api.removeAssociation('w_1', 'w_0'); assert.deepEqual(api.getAssociations('w_0'), []);
});
