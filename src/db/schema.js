'use strict';
const SCHEMA_VERSION = 1;
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
CREATE TABLE IF NOT EXISTS persistence_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;
module.exports = { SCHEMA_VERSION, SCHEMA_SQL };
