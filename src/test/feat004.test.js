'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { StorageService } = require('../services/storage');
const { LibraryStore } = require('../store/libraryStore');
const { QuizEngine } = require('../services/quizEngine');
const { starterWords } = require('../db/seed');
const { registerHandlers } = require('../services/ipc');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feat004-'));
  const storage = new StorageService(dir, false);
  t.after(() => { storage.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const words = ['serendipity', 'taciturn', 'garrulous', 'ephemeral', 'obsequious', 'petrichor'].map((word, i) => ({
    ...starterWords()[0], id: `word_${i}`, word, displayWord: word,
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: `Definition ${i}`, example: `A ${word.toUpperCase()} appears beside ${word}.` }] }]
  }));
  storage.saveWords(words);
  return { storage, words, dir, engine: new QuizEngine(storage) };
}
test('favorites, tags and multiple collections persist and hydrate all read paths', t => {
  const { storage: s, words, dir } = fixture(t); const id = words[0].id;
  assert.equal(s.toggleFavorite(id), true);
  const a = s.createCollection(' Literature ', 'Books', '#aabbcc'); const b = s.createCollection('Speech');
  assert.throws(() => s.createCollection('Literature'));
  assert.throws(() => s.createCollection('  '));
  assert.equal(s.assignWordToCollection(id, a.id), true);
  assert.equal(s.assignWordToCollection(id, a.id), false);
  s.assignWordToCollection(id, b.id); s.assignWordToCollection(words[1].id, a.id);
  s.setWordTags(id, ['#Archaic', ' Latinate ', 'dialogue', '##ARCHAIC', ' ']);
  assert.deepEqual(s.getWordTags(id), ['archaic', 'latinate', 'dialogue']);
  assert.deepEqual(s.getAllTags().find(tag => tag.tag === 'archaic'), { tag: 'archaic', count: 1 });
  const expected = s.selectOne(id);
  for (const list of [s.getWords(), s.getFavorites(), s.getWordsByTag('#ARCHAIC'), s.getWordsInCollection(a.id), s.getDueWordsQueue(new Date('2099-01-01'))]) {
    assert.deepEqual(list.find(word => word.id === id), expected);
  }
  assert.deepEqual(expected.collections, [a.id, b.id]);
  assert.equal(s.getCollections().find(c => c.id === a.id).wordCount, 2);
  s.saveWords(s.exportData()); assert.deepEqual(s.selectOne(id), expected);
  s.close(); const reopened = new StorageService(dir, false);
  try {
    assert.deepEqual(reopened.selectOne(id), expected);
    assert.equal(reopened.toggleFavorite(id), false); assert.deepEqual(reopened.getFavorites(), []);
    assert.equal(reopened.removeWordFromCollection(id, b.id), true);
    assert.equal(reopened.deleteCollection(a.id), true);
    assert.equal(reopened.getWords().length, words.length);
    assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM word_collections WHERE collection_id = ?').get(a.id).n, 0);
    reopened.removeWord(id); assert.deepEqual(reopened.getAllTags(), []);
    assert.throws(() => reopened.assignWordToCollection('missing', b.id), /FOREIGN KEY/);
    assert.throws(() => reopened.toggleFavorite('missing'), /not found/);
    assert.throws(() => reopened.setWordTags('missing', []), /not found/);
  } finally { reopened.close(); }
});
test('tag replacement and word replacement roll back organization metadata on failure', t => {
  const { storage: s, words } = fixture(t); const id = words[0].id;
  s.setWordTags(id, ['old']); s.toggleFavorite(id);
  s.db.exec("CREATE TRIGGER fail_tag BEFORE INSERT ON word_tags WHEN NEW.tag = 'bad' BEGIN SELECT RAISE(ABORT, 'tag rejected'); END");
  assert.throws(() => s.setWordTags(id, ['new', 'bad']), /tag rejected/);
  assert.deepEqual(s.getWordTags(id), ['old']);
  const original = s.getWords();
  assert.throws(() => s.saveWords([{ ...original[0], tags: ['bad'] }]));
  assert.deepEqual(s.getWords(), original);
});
test('v2 migration preserves words and rolls back schema changes if any migration statement fails', t => {
  const { storage: s, words, dir } = fixture(t);
  s.db.exec(`DROP TABLE word_tags; DROP TABLE word_collections; DROP TABLE collections;
    DROP INDEX idx_words_favorite; ALTER TABLE words DROP COLUMN is_favorite;
    UPDATE schema_meta SET value = '2' WHERE key = 'schema_version'; PRAGMA user_version = 2;
    CREATE TABLE collections (broken TEXT);`);
  s.close(); assert.throws(() => new StorageService(dir, false));
  const probe = new DatabaseSync(path.join(dir, 'vocab_buddy.db'));
  assert.equal(probe.prepare('PRAGMA user_version').get().user_version, 2);
  assert.equal(probe.prepare('PRAGMA table_info(words)').all().some(c => c.name === 'is_favorite'), false);
  probe.exec('DROP TABLE collections'); probe.close();
  const upgraded = new StorageService(dir, false);
  try {
    assert.equal(upgraded.db.prepare('PRAGMA user_version').get().user_version, 5);
    assert.equal(upgraded.db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.deepEqual(upgraded.getWords(), words.map(word => ({ ...word, isFavorite: false, tags: [], collections: [] })));
  } finally { upgraded.close(); }
});
test('all quiz modes track targets and provide valid unique answers; filters intersect', t => {
  const { storage: s, words, engine } = fixture(t);
  for (const mode of ['definition', 'cloze', 'missing_letters']) {
    const deck = engine.generateQuiz(mode); assert.equal(deck.length, 5);
    assert.equal(new Set(deck.map(q => q.wordId)).size, 5);
    for (const q of deck) {
      const target = words.find(word => word.id === q.wordId);
      if (mode === 'missing_letters') {
        assert.equal(q.solution, target.word); assert.ok(q.maskedWord.includes('_'));
        assert.equal(q.definition, target.meanings[0].definitions[0].definition);
      } else {
        assert.equal(new Set(q.options).size, 4);
        assert.equal(q.options[q.correctAnswerIndex], mode === 'definition' ? target.meanings[0].definitions[0].definition : target.word);
        if (mode === 'cloze') assert.equal(q.promptSentence, 'A _______ appears beside _______.');
      }
    }
  }
  const col = s.createCollection('Small'); s.assignWordToCollection(words[0].id, col.id); s.assignWordToCollection(words[1].id, col.id);
  s.setWordTags(words[0].id, ['quiz']); s.setWordTags(words[2].id, ['quiz']);
  const deck = engine.generateQuiz('definition', { collectionId: col.id, tag: '#QUIZ' });
  assert.equal(deck.length, 1); assert.equal(deck[0].wordId, words[0].id);
  s.toggleFavorite(words[0].id);
  const favDeck = engine.generateQuiz('definition', { favoritesOnly: true, limit: 5 });
  assert.equal(favDeck.length, 1); assert.equal(favDeck[0].wordId, words[0].id);
  assert.throws(() => engine.generateQuiz('bogus')); assert.throws(() => engine.generateQuiz('cloze', { limit: 100 }));
  assert.equal(engine.cloze('Taciturnity is taciturn.', 'taciturn'), 'Taciturnity is _______.');
  assert.equal(new QuizEngine(s.db).generateQuiz('definition', { limit: 10 }).length, 6);
});
test('quizzes skip unavailable examples and insufficient distinct distractors', t => {
  const { storage: s, words, engine } = fixture(t);
  for (const word of words) word.meanings[0].definitions[0] = { definition: 'Same definition', example: 'No matching term.' };
  s.saveWords(words);
  assert.deepEqual(engine.generateQuiz('definition'), []); assert.deepEqual(engine.generateQuiz('cloze'), []);
  assert.equal(engine.generateQuiz('missing_letters').length, 5);
  s.saveWords([]); assert.deepEqual(engine.generateQuiz('missing_letters'), []);
});
test('IPC organization and quiz channels delegate through store; SRS feedback is optional and atomic', t => {
  const { storage: s, words } = fixture(t); const store = new LibraryStore(s); const id = words[0].id;
  const handlers = new Map();
  registerHandlers({ handle: (channel, fn) => handlers.set(channel, fn) }, store, {}, frame => frame === 'trusted');
  const call = (channel, ...args) => handlers.get(channel)({ senderFrame: 'trusted' }, ...args);
  for (const handler of handlers.values()) assert.throws(() => handler({ senderFrame: 'untrusted' }), /Untrusted/);
  assert.equal(call('vocab:favorite:toggle', id), true);
  const collection = call('vocab:collections:create', { name: 'Quiz' });
  call('vocab:collections:assign', id, collection.id); call('vocab:tags:set', id, ['#Test']);
  assert.equal(call('vocab:collections:list')[0].wordCount, 1);
  assert.deepEqual(call('vocab:tags:list'), [{ tag: 'test', count: 1 }]);
  assert.equal(call('vocab:quiz:generate', 'definition', { collectionId: collection.id }).length, 1);
  store.reviewWord(id, 'good'); const boxTwo = s.selectOne(id).review;
  call('vocab:quiz:submit', id, false, false); assert.deepEqual(s.selectOne(id).review, boxTwo);
  call('vocab:quiz:submit', id, true, true); assert.equal(s.selectOne(id).review.box, 3);
  call('vocab:quiz:submit', id, false, true); assert.equal(s.selectOne(id).review.box, 1);
  assert.ok(Date.parse(s.selectOne(id).review.nextReviewDate) <= Date.now());
  assert.throws(() => call('vocab:quiz:submit', id, 'false', true), /Invalid/);
  assert.throws(() => call('vocab:quiz:submit', 'missing', true, false), /not found/);
  const before = s.selectOne(id);
  s.db.exec("CREATE TRIGGER fail_review BEFORE UPDATE ON words BEGIN SELECT RAISE(ABORT, 'review rejected'); END");
  assert.throws(() => call('vocab:quiz:submit', id, false, true), /review rejected/);
  assert.deepEqual(s.selectOne(id), before);
  assert.equal(call('vocab:collections:unassign', id, collection.id), true);
  assert.equal(call('vocab:collections:delete', collection.id), true);
});
