'use strict';
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateWords } = require('../db/wordSchema');
const { SCHEMA_VERSION, openDatabase, initializeSchema } = require('../db/sqliteSchema');
const { BOX_METRICS, calculateNextReview } = require('./spacedRepetition');
const { starterWords } = require('../db/seed');
const FIELDS = {
  id: 'id', word: 'word', displayWord: 'display_word', phonetic: 'phonetic',
  audioUrl: 'audio_url', audioLocalPath: 'audio_local_path', audioSizeBytes: 'audio_size_bytes',
  inflectedForm: 'inflected_form', etymology: 'etymology', bookSource: 'book_source', createdAt: 'created_at'
};
const REVIEW_FIELDS = { box: 'box', boxLabel: 'box_label', nextReviewDate: 'next_review_date', reviewCount: 'review_count', streak: 'streak', lastRating: 'last_rating', lastReviewedAt: 'last_reviewed_at', intervalDays: 'interval_days' };
const JSON_FIELDS = ['meanings', 'synonyms', 'antonyms'];
const columns = [...Object.values(FIELDS), ...Object.values(REVIEW_FIELDS), ...JSON_FIELDS.map(key => `${key}_json`), 'next_review_at', 'is_favorite'];
function normalized(word) {
  return { ...word, review: { ...word.review, boxLabel: word.review.boxLabel ?? BOX_METRICS[word.review.box].label, intervalDays: word.review.intervalDays ?? 1 } };
}
function values(model) {
  const word = normalized(model);
  return [...Object.keys(FIELDS).map(key => word[key] ?? null), ...Object.keys(REVIEW_FIELDS).map(key => word.review[key]), ...JSON_FIELDS.map(key => JSON.stringify(word[key])), Date.parse(word.review.nextReviewDate), word.isFavorite ? 1 : 0];
}
function model(row) {
  const word = {};
  for (const [key, column] of Object.entries(FIELDS)) if (row[column] !== null) word[key] = row[column];
  word.review = Object.fromEntries(Object.entries(REVIEW_FIELDS).map(([key, column]) => [key, row[column]]));
  for (const key of JSON_FIELDS) word[key] = JSON.parse(row[`${key}_json`]);
  return validateWords([word])[0];
}
class StorageService {
  constructor(storageDir, autoSeed = true) {
    fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 });
    this.filePath = path.join(storageDir, 'vocab_buddy.db');
    this.legacyPath = path.join(storageDir, 'vocab_library.json');
    this.db = openDatabase(this.filePath);
    this.closed = false;
    try {
      this.transaction(() => {
        const version = initializeSchema(this.db);
        this.insert = this.db.prepare(`INSERT INTO words (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
        if (version === 0) {
          let words;
          try {
            const text = fs.readFileSync(this.legacyPath, 'utf8');
            const payload = JSON.parse(text);
            if (payload.version !== '1.0' || !Number.isFinite(Date.parse(payload.updatedAt))) throw new TypeError('Invalid legacy library payload');
            words = validateWords(payload.words);
            this.db.prepare("INSERT INTO schema_meta VALUES ('legacy_rename_pending', '1')").run();
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            words = autoSeed ? starterWords() : [];
          }
          for (const word of words) this.insert.run(...values(word));
        }
        this.db.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
        this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      });
      this.finishLegacyMigration();
      this.selectAll = this.db.prepare('SELECT * FROM words ORDER BY rowid');
      this.selectDue = this.db.prepare('SELECT * FROM words WHERE next_review_at <= ? ORDER BY next_review_at, rowid');
      this.selectStats = this.db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(next_review_at <= ?), 0) AS due, COALESCE(SUM(box = 5), 0) AS mastered FROM words');
      this.selectRow = this.db.prepare('SELECT * FROM words WHERE id = ?');
      this.deleteOne = this.db.prepare('DELETE FROM words WHERE id = ?');
      this.updateReview = this.db.prepare(`UPDATE words SET ${Object.values(REVIEW_FIELDS).map(column => `${column} = ?`).join(', ')}, next_review_at = ? WHERE id = ?`);
    } catch (error) { this.db.close(); throw error; }
  }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  finishLegacyMigration() {
    if (!this.db.prepare("SELECT 1 FROM schema_meta WHERE key = 'legacy_rename_pending'").get()) return;
    const backup = `${this.legacyPath}.migrated`;
    if (fs.existsSync(this.legacyPath)) {
      if (fs.existsSync(backup)) throw new Error('Legacy migration backup already exists; preserve both files before retrying');
      fs.renameSync(this.legacyPath, backup);
    } else if (!fs.existsSync(backup)) throw new Error('Legacy migration source and backup are missing');
    this.db.prepare("DELETE FROM schema_meta WHERE key = 'legacy_rename_pending'").run();
  }
  hydrate(row) {
    return { ...model(row), isFavorite: Boolean(row.is_favorite),
      collections: this.db.prepare('SELECT collection_id FROM word_collections WHERE word_id = ? ORDER BY rowid').all(row.id).map(item => item.collection_id),
      tags: this.getWordTags(row.id) };
  }
  selectOne(id) { const row = this.selectRow.get(id); return row ? this.hydrate(row) : undefined; }
  getWords() { return this.loadWords(); }
  getWordByHeadword(word) { const row = this.db.prepare('SELECT * FROM words WHERE word = ?').get(word); return row ? this.hydrate(row) : null; }
  updatePronunciation(id, { audioUrl, audioLocalPath, audioSizeBytes }) {
    const word = this.selectOne(id);
    if (!word) return false;
    validateWords([{ ...word, audioUrl, audioLocalPath, audioSizeBytes }]);
    return this.db.prepare('UPDATE words SET audio_url = ?, audio_local_path = ?, audio_size_bytes = ? WHERE id = ?').run(audioUrl, audioLocalPath, audioSizeBytes, id).changes > 0;
  }
  loadWords() { return this.selectAll.all().map(row => this.hydrate(row)); }
  requireWord(id) { if (!this.selectRow.get(id)) throw new Error('Word not found'); }
  toggleFavorite(id) {
    const row = this.db.prepare('UPDATE words SET is_favorite = 1 - is_favorite WHERE id = ? RETURNING is_favorite').get(id);
    if (!row) throw new Error('Word not found');
    return Boolean(row.is_favorite);
  }
  getFavorites() { return this.db.prepare('SELECT * FROM words WHERE is_favorite = 1 ORDER BY rowid').all().map(row => this.hydrate(row)); }
  createCollection(name, description = '', colorAccent = '') {
    if (typeof name !== 'string' || !name.trim() || typeof description !== 'string' || typeof colorAccent !== 'string') throw new TypeError('Invalid collection');
    const collection = { id: `col_${Date.now()}_${randomUUID()}`, name: name.trim(), description, colorAccent, createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO collections VALUES (?, ?, ?, ?, ?)').run(collection.id, collection.name, description, colorAccent, collection.createdAt);
    return collection;
  }
  getCollections() {
    return this.db.prepare(`SELECT c.id, c.name, c.description, c.color_accent AS colorAccent,
      c.created_at AS createdAt, COUNT(w.word_id) AS wordCount FROM collections c
      LEFT JOIN word_collections w ON w.collection_id = c.id GROUP BY c.id ORDER BY c.rowid`).all().map(row => ({ ...row }));
  }
  deleteCollection(id) { return this.db.prepare('DELETE FROM collections WHERE id = ?').run(id).changes > 0; }
  assignWordToCollection(wordId, collectionId) { return this.db.prepare('INSERT OR IGNORE INTO word_collections VALUES (?, ?)').run(wordId, collectionId).changes > 0; }
  removeWordFromCollection(wordId, collectionId) { return this.db.prepare('DELETE FROM word_collections WHERE word_id = ? AND collection_id = ?').run(wordId, collectionId).changes > 0; }
  getWordsInCollection(id) { return this.db.prepare('SELECT w.* FROM words w JOIN word_collections c ON c.word_id = w.id WHERE c.collection_id = ? ORDER BY w.rowid').all(id).map(row => this.hydrate(row)); }
  setWordTags(wordId, tags) {
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) throw new TypeError('Invalid tags');
    const normalized = [...new Set(tags.map(normalizeTag).filter(Boolean))];
    return this.transaction(() => {
      this.requireWord(wordId);
      this.db.prepare('DELETE FROM word_tags WHERE word_id = ?').run(wordId);
      const insert = this.db.prepare('INSERT INTO word_tags VALUES (?, ?)');
      for (const tag of normalized) insert.run(wordId, tag);
      return true;
    });
  }
  getWordTags(id) { return this.db.prepare('SELECT tag FROM word_tags WHERE word_id = ? ORDER BY rowid').all(id).map(row => row.tag); }
  getAllTags() { return this.db.prepare('SELECT tag, COUNT(*) AS count FROM word_tags GROUP BY tag ORDER BY tag').all().map(row => ({ ...row })); }
  getWordsByTag(tag) { return this.db.prepare('SELECT w.* FROM words w JOIN word_tags t ON t.word_id = w.id WHERE t.tag = ? ORDER BY w.rowid').all(normalizeTag(tag)).map(row => this.hydrate(row)); }
  addAssociation(wordId1, wordId2, note = '') {
    const [a, b] = associationPair(wordId1, wordId2);
    if (typeof note !== 'string') throw new TypeError('Invalid association note');
    return this.transaction(() => {
      this.requireWord(a); this.requireWord(b);
      this.db.prepare(`INSERT INTO word_associations VALUES (?, ?, ?, ?)
        ON CONFLICT(word_id_1, word_id_2) DO UPDATE SET note = excluded.note`).run(a, b, note, new Date().toISOString());
      return { success: true, association: { wordId1: a, wordId2: b, note } };
    });
  }
  removeAssociation(wordId1, wordId2) {
    const [a, b] = associationPair(wordId1, wordId2);
    this.db.prepare('DELETE FROM word_associations WHERE word_id_1 = ? AND word_id_2 = ?').run(a, b);
    return { success: true };
  }
  getAssociationsForWord(wordId) {
    validateConnectionId(wordId); this.requireWord(wordId);
    return this.db.prepare(`SELECT w.id AS associatedWordId, w.display_word AS displayWord,
      w.word, a.note, a.created_at AS createdAt FROM word_associations a
      JOIN words w ON w.id = a.word_id_2 WHERE a.word_id_1 = ?
      UNION ALL SELECT w.id, w.display_word, w.word, a.note, a.created_at
      FROM word_associations a JOIN words w ON w.id = a.word_id_1 WHERE a.word_id_2 = ?
      ORDER BY associatedWordId`).all(wordId, wordId).map(row => ({ ...row }));
  }
  getConnectionsNeighborhood(wordId, sampleLimit = 10) {
    validateConnectionId(wordId);
    if (!Number.isInteger(sampleLimit) || sampleLimit < 0 || sampleLimit > 100) throw new TypeError('Sample limit must be an integer between 0 and 100');
    this.requireWord(wordId);
    const center = this.selectOne(wordId);
    const wordNode = word => {
      const data = { word: word.word, bookSource: word.bookSource ?? '', review: word.review };
      return { id: word.id, type: 'word', label: word.displayWord, ...data, data };
    };
    const nodes = [wordNode(center)]; const links = [];
    const hub = (id, type, label, from, where, value) => {
      const totalCount = this.db.prepare(`SELECT COUNT(*) AS n FROM ${from} WHERE ${where}`).get(value).n;
      const sampleWords = this.db.prepare(`SELECT w.id, w.word, w.display_word AS displayWord FROM ${from}
        WHERE ${where} ORDER BY w.id LIMIT ?`).all(value, sampleLimit).map(row => ({ ...row }));
      nodes.push({ id, type, label, totalCount, sampleWords, data: { memberCount: totalCount, sampleWords } });
      links.push({ source: wordId, target: id, type });
    };
    if (center.bookSource?.trim()) hub(`src:${encodeURIComponent(center.bookSource)}`, 'source', center.bookSource,
      'words w', 'w.book_source = ?', center.bookSource);
    for (const tag of center.tags) hub(`tag:${tag}`, 'tag', `#${tag}`,
      'words w JOIN word_tags t ON t.word_id = w.id', 't.tag = ?', tag);
    for (const shelf of this.db.prepare(`SELECT c.id, c.name FROM collections c JOIN word_collections wc
      ON wc.collection_id = c.id WHERE wc.word_id = ? ORDER BY c.id`).all(wordId)) {
      hub(`shelf:${shelf.id}`, 'shelf', shelf.name, 'words w JOIN word_collections wc ON wc.word_id = w.id', 'wc.collection_id = ?', shelf.id);
    }
    for (const association of this.getAssociationsForWord(wordId)) {
      nodes.push(wordNode(this.selectOne(association.associatedWordId)));
      links.push({ source: wordId, target: association.associatedWordId, type: 'association', note: association.note });
    }
    return { centerId: wordId, nodes, links };
  }
  submitQuiz(wordId, success, linkToSrs) {
    if (typeof success !== 'boolean' || typeof linkToSrs !== 'boolean') throw new TypeError('Invalid quiz result');
    return this.transaction(() => {
      this.requireWord(wordId);
      if (linkToSrs) {
        const now = new Date();
        const word = model(this.selectRow.get(wordId));
        word.review = calculateNextReview(word.review, success ? 'good' : 'again', now);
        if (!success) word.review.nextReviewDate = now.toISOString();
        this.updateReview.run(...Object.keys(REVIEW_FIELDS).map(key => word.review[key]), Date.parse(word.review.nextReviewDate), wordId);
      }
      return true;
    });
  }
  saveWords(words) {
    validateWords(words);
    this.transaction(() => {
      const encounters = this.db.prepare('SELECT * FROM reading_encounters').all();
      this.db.exec('DELETE FROM words');
      for (const word of words) {
        this.insert.run(...values(word));
        for (const id of word.collections ?? []) this.assignWordToCollection(word.id, id);
        const insertTag = this.db.prepare('INSERT OR IGNORE INTO word_tags VALUES (?, ?)');
        for (const tag of word.tags ?? []) if (normalizeTag(tag)) insertTag.run(word.id, normalizeTag(tag));
      }
      const retainedIds = new Set(words.map(word => word.id));
      const restore = this.db.prepare('INSERT INTO reading_encounters VALUES (?, ?, ?)');
      for (const encounter of encounters) if (retainedIds.has(encounter.word_id)) restore.run(encounter.capture_id, encounter.word_id, encounter.payload_json);
    });
    return true;
  }
  addWord(word) {
    validateWords([word]);
    return this.transaction(() => {
      if (this.db.prepare('SELECT 1 FROM words WHERE word = ?').get(word.word)) throw new Error('Word already saved');
      if (this.db.prepare('SELECT COUNT(*) AS total FROM words').get().total >= 100000) throw new TypeError('Maximum 100000 entries');
      this.insert.run(...values(word));
      for (const id of word.collections ?? []) this.assignWordToCollection(word.id, id);
      const insertTag = this.db.prepare('INSERT OR IGNORE INTO word_tags VALUES (?, ?)');
      for (const tag of word.tags ?? []) if (normalizeTag(tag)) insertTag.run(word.id, normalizeTag(tag));
      return true;
    });
  }

  getReadingEncounters(wordId) {
    return this.db.prepare('SELECT payload_json FROM reading_encounters WHERE word_id = ? ORDER BY rowid').all(wordId).map(row => JSON.parse(row.payload_json));
  }
  getCaptureWord(captureId) {
    const row = this.db.prepare('SELECT word_id FROM reading_encounters WHERE capture_id = ?').get(captureId);
    return row ? this.selectOne(row.word_id) : null;
  }
  saveCapture(payload, enriched) {
    return this.transaction(() => {
      const replay = this.getCaptureWord(payload.id);
      if (replay) return { word: replay, isDuplicate: true };
      const existing = this.getWordByHeadword(enriched?.word ?? payload.word);
      const word = existing ?? enriched;
      if (!word) throw new Error('Word disappeared; retry capture');
      if (payload.shelfId && !this.db.prepare('SELECT 1 FROM collections WHERE id = ?').get(payload.shelfId)) throw new TypeError('Selected shelf does not exist');
      if (!existing) {
        validateWords([word]);
        if (this.db.prepare('SELECT COUNT(*) AS n FROM words').get().n >= 100000) throw new Error('Library is full');
        this.insert.run(...values(word));
      }
      this.db.prepare('INSERT INTO reading_encounters VALUES (?, ?, ?)').run(payload.id, word.id, JSON.stringify(payload));
      if (payload.shelfId) this.assignWordToCollection(word.id, payload.shelfId);
      const tagInsert = this.db.prepare('INSERT OR IGNORE INTO word_tags VALUES (?, ?)');
      for (const tag of payload.tags ?? []) if (normalizeTag(tag)) tagInsert.run(word.id, normalizeTag(tag));
      return { word: this.selectOne(word.id), isDuplicate: Boolean(existing) };
    });
  }

  removeWord(id) { this.deleteOne.run(id); return true; }
  reviewWord(id, rating, now = new Date()) {
    return this.transaction(() => {
      const row = this.selectRow.get(id);
      if (!row) throw new Error('Word not found');
      const word = model(row);
      word.review = calculateNextReview(word.review, rating, now);
      validateWords([word]);
      this.updateReview.run(...Object.keys(REVIEW_FIELDS).map(key => word.review[key]), Date.parse(word.review.nextReviewDate), id);
      return true;
    });
  }
  getDueWordsQueue(now = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('Invalid review date');
    return this.selectDue.all(now.getTime()).map(row => this.hydrate(row));
  }
  getReviewStats(now = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('Invalid review date');
    const { total, due, mastered } = this.selectStats.get(now.getTime());
    return { total, due, mastered, learning: total - mastered };
  }
  exportData() { return this.loadWords(); }
  importData(words) { return this.saveWords(words); }
  close() { if (!this.closed) { this.db.close(); this.closed = true; } }
}
function validateConnectionId(id) {
  if (typeof id !== 'string' || !id.trim() || id.includes('\0')) throw new TypeError('Invalid word ID');
}
function associationPair(a, b) {
  validateConnectionId(a); validateConnectionId(b);
  if (a === b) throw new TypeError('Cannot associate a word with itself');
  return Buffer.compare(Buffer.from(a), Buffer.from(b)) < 0 ? [a, b] : [b, a];
}
function normalizeTag(tag) {
  if (typeof tag !== 'string') throw new TypeError('Invalid tag');
  return tag.trim().replace(/^#+/, '').trim().toLowerCase();
}
module.exports = { StorageService, normalizeTag };
