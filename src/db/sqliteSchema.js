'use strict';
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const SCHEMA_VERSION = 3;
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
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
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
  if (!db.prepare('PRAGMA table_info(words)').all().some(column => column.name === 'is_favorite')) {
    db.exec('ALTER TABLE words ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1))');
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_words_favorite ON words(is_favorite);
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, description TEXT,
      color_accent TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
    CREATE TABLE IF NOT EXISTS word_collections (
      word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      PRIMARY KEY (word_id, collection_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wc_collection ON word_collections(collection_id);
    CREATE INDEX IF NOT EXISTS idx_wc_word ON word_collections(word_id);
    CREATE TABLE IF NOT EXISTS word_tags (
      word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      tag TEXT NOT NULL, PRIMARY KEY (word_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_word_tags_tag ON word_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_word_tags_word ON word_tags(word_id);
  `);
  return version;
}
module.exports = { SCHEMA_VERSION, SCHEMA_SQL, openDatabase, initializeSchema };
