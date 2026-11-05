'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { StorageService } = require('../services/storage');
const { getShowcaseData, applyShowcaseToStorage } = require('../db/showcase');

test('showcase persists words, shelves, tags, favorites and mutual connections on repeat seeding', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-showcase-'));
  let storage = new StorageService(dir, false);
  t.after(() => { storage.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const expected = getShowcaseData();
  for (let run = 0; run < 2; run++) {
    assert.deepEqual(applyShowcaseToStorage(storage), {
      wordCount: expected.words.length, shelfCount: expected.shelves.length,
      assocCount: expected.associations.length
    });
    storage.close();
    storage = new StorageService(dir, false);
    assert.equal(storage.getWords().length, expected.words.length);
    assert.equal(storage.getCollections().length, expected.shelves.length);
    for (const word of expected.words) {
      const saved = storage.getWords().find(w => w.id === word.id);
      assert.equal(saved.isFavorite, Boolean(word.isFavorite));
      assert.deepEqual([...saved.tags].sort(), [...word.tags].sort());
      assert.equal(saved.collections.length, word.collections.length);
      const graph = storage.getConnectionsNeighborhood(word.id);
      assert.equal(graph.nodes.filter(n => n.type === 'shelf').length, word.collections.length);
    }
    for (const assoc of expected.associations) {
      for (const [from, to] of [[assoc.wordId1, assoc.wordId2], [assoc.wordId2, assoc.wordId1]]) {
        assert.equal(storage.getAssociationsForWord(from).find(a => a.associatedWordId === to).note, assoc.note);
      }
    }
  }
});
