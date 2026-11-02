'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { validateWords } = require('../db/wordSchema');
const { SCHEMA_VERSION, SCHEMA_SQL } = require('../db/schema');
const { BOX_METRICS, calculateNextReview } = require('./spacedRepetition');
const { starterWords } = require('../db/seed');
const FIELDS = {
  id: 'id', word: 'word', displayWord: 'display_word', phonetic: 'phonetic',
  audioUrl: 'audio_url', audioLocalPath: 'audio_local_path', audioSizeBytes: 'audio_size_bytes',
  inflectedForm: 'inflected_form', etymology: 'etymology', bookSource: 'book_source', createdAt: 'created_at'
};
const REVIEW_FIELDS = { box: 'box', boxLabel: 'box_label', nextReviewDate: 'next_review_date', reviewCount: 'review_count', streak: 'streak', lastRating: 'last_rating', lastReviewedAt: 'last_reviewed_at', intervalDays: 'interval_days' };
const JSON_FIELDS = ['meanings', 'synonyms', 'antonyms'];
const columns = [...Object.values(FIELDS), ...Object.values(REVIEW_FIELDS), ...JSON_FIELDS.map(key => `${key}_json`)];
function normalized(word) {
  return { ...word, review: { ...word.review, boxLabel: word.review.boxLabel ?? BOX_METRICS[word.review.box].label, intervalDays: word.review.intervalDays ?? 1 } };
}
function values(model) {
  const word = normalized(model);
  return [...Object.keys(FIELDS).map(key => word[key] ?? null), ...Object.keys(REVIEW_FIELDS).map(key => word.review[key]), ...JSON_FIELDS.map(key => JSON.stringify(word[key]))];
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
    // SQLite inherits the database permissions for its WAL/SHM sidecars.
    try { fs.closeSync(fs.openSync(this.filePath, 'wx', 0o600)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    this.db = new DatabaseSync(this.filePath);
    this.closed = false;
    try {
      this.db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
      this.transaction(() => {
        const version = this.db.prepare('PRAGMA user_version').get().user_version;
        if (version > SCHEMA_VERSION) throw new Error('Unsupported database schema version');
        this.db.exec(SCHEMA_SQL);
        this.insert = this.db.prepare(`INSERT INTO words (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
        if (version === 0) {
          let words;
          try {
            const text = fs.readFileSync(this.legacyPath, 'utf8');
            const payload = JSON.parse(text);
            if (payload.version !== '1.0' || !Number.isFinite(Date.parse(payload.updatedAt))) throw new TypeError('Invalid legacy library payload');
            words = validateWords(payload.words);
            this.db.prepare("INSERT INTO persistence_meta VALUES ('legacy_rename_pending', '1')").run();
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            words = autoSeed ? starterWords() : [];
          }
          for (const word of words) this.insert.run(...values(word));
          this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        }
      });
      this.finishLegacyMigration();
      this.selectAll = this.db.prepare('SELECT * FROM words ORDER BY rowid');
      this.selectOne = this.db.prepare('SELECT * FROM words WHERE id = ?');
      this.deleteOne = this.db.prepare('DELETE FROM words WHERE id = ?');
      this.updateReview = this.db.prepare(`UPDATE words SET ${Object.values(REVIEW_FIELDS).map(column => `${column} = ?`).join(', ')} WHERE id = ?`);
    } catch (error) { this.db.close(); throw error; }
  }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  finishLegacyMigration() {
    if (!this.db.prepare("SELECT 1 FROM persistence_meta WHERE key = 'legacy_rename_pending'").get()) return;
    const backup = `${this.legacyPath}.migrated`;
    if (fs.existsSync(this.legacyPath)) {
      if (fs.existsSync(backup)) throw new Error('Legacy migration backup already exists; preserve both files before retrying');
      fs.renameSync(this.legacyPath, backup);
    } else if (!fs.existsSync(backup)) throw new Error('Legacy migration source and backup are missing');
    this.db.prepare("DELETE FROM persistence_meta WHERE key = 'legacy_rename_pending'").run();
  }
  loadWords() { return this.selectAll.all().map(model); }
  saveWords(words) {
    validateWords(words);
    this.transaction(() => {
      this.db.exec('DELETE FROM words');
      for (const word of words) this.insert.run(...values(word));
    });
    return true;
  }
  addWord(word) {
    validateWords([word]);
    return this.transaction(() => {
      if (this.db.prepare('SELECT 1 FROM words WHERE word = ?').get(word.word)) throw new Error('Word already saved');
      if (this.db.prepare('SELECT COUNT(*) AS total FROM words').get().total >= 100000) throw new TypeError('Maximum 100000 entries');
      this.insert.run(...values(word));
      return true;
    });
  }

  removeWord(id) { this.deleteOne.run(id); return true; }
  reviewWord(id, rating, now = new Date()) {
    return this.transaction(() => {
      const row = this.selectOne.get(id);
      if (!row) throw new Error('Word not found');
      const word = model(row);
      word.review = calculateNextReview(word.review, rating, now);
      validateWords([word]);
      this.updateReview.run(...Object.keys(REVIEW_FIELDS).map(key => word.review[key]), id);
      return true;
    });
  }
  exportData() { return this.loadWords(); }
  importData(words) { return this.saveWords(words); }
  close() { if (!this.closed) { this.db.close(); this.closed = true; } }
}
module.exports = { StorageService };
