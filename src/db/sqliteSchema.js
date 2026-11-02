'use strict';
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const SCHEMA_VERSION = 2;
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL UNIQUE,
  display_word TEXT NOT NULL,
  phonetic TEXT,
  audio_url TEXT,
  audio_local_path TEXT,
  audio_size_bytes INTEGER,
  inflected_form TEXT,
  etymology TEXT,
  book_source TEXT,
  created_at TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  box_label TEXT NOT NULL DEFAULT 'Daily',
  next_review_date TEXT NOT NULL,
  next_review_at INTEGER NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_rating TEXT,
  last_reviewed_at TEXT,
  interval_days REAL NOT NULL DEFAULT 1 CHECK (interval_days > 0),
  meanings_json TEXT NOT NULL DEFAULT '[]',
  synonyms_json TEXT NOT NULL DEFAULT '[]',
  antonyms_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_words_due ON words(next_review_date);
CREATE INDEX IF NOT EXISTS idx_words_box ON words(box);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
CREATE INDEX IF NOT EXISTS idx_words_inflected ON words(inflected_form);
CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;
function openDatabase(filePath) {
  try { fs.closeSync(fs.openSync(filePath, 'wx', 0o600)); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const db = new DatabaseSync(filePath);
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    return db;
  } catch (error) { db.close(); throw error; }
}
// Called inside the storage initialization transaction so upgrades roll back together.
function initializeSchema(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > SCHEMA_VERSION) throw new Error('Unsupported database schema version');
  const hasOldMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'persistence_meta'").get();
  const hasMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'").get();
  if (hasOldMeta && !hasMeta) db.exec('ALTER TABLE persistence_meta RENAME TO schema_meta');
  db.exec(SCHEMA_SQL);
  if (!db.prepare('PRAGMA table_info(words)').all().some(column => column.name === 'next_review_at')) {
    db.exec('ALTER TABLE words ADD COLUMN next_review_at INTEGER');
    const update = db.prepare('UPDATE words SET next_review_at = ? WHERE id = ?');
    for (const row of db.prepare('SELECT id, next_review_date FROM words').all()) {
      const timestamp = Date.parse(row.next_review_date);
      if (!Number.isFinite(timestamp)) throw new TypeError('Invalid persisted review date');
      update.run(timestamp, row.id);
    }
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_words_due_timestamp ON words(next_review_at)');
  return version;
}
module.exports = { SCHEMA_VERSION, SCHEMA_SQL, openDatabase, initializeSchema };
