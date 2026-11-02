---
title: "Vocab Buddy: SQLite Persistence Engine (FEAT-003)"
type: prd_and_spec
feature_code: FEAT-003
status: backend_complete # draft | ready_for_backend | backend_complete | frontend_integrated | ready_to_ship
active_owner: gemini # gemini | codex | human
created_at: 2026-11-02
updated_at: 2026-11-02
---

# Feature Specification: FEAT-003 SQLite Persistence Engine

> **Feature Code:** FEAT-003  
> **Active Stage:** Backend Complete — Ready for Frontend Integration (Stage 3)  
> **Lead Architect (Stage 1 & 3):** Gemini  
> **Backend & Verification Lead (Stage 2 & 4):** Codex  
> **Repository:** `/home/zeto/Desktop/projects/Vocab Buddy`  
> **Obsidian Hub:** `/home/zeto/Documents/Obsidian Vault/Projects/Vocab Buddy/`  

---

## 1. Context & Motivation

Vocab Buddy previously serialized all vocabulary entries into a monolithic JSON file (`userData/vocab_library.json`). Every user rating in the flashcard deck triggered an $O(N)$ write amplification cycle: JSON serialization, writing to a `.tmp` file, and atomic file replacement.

To eliminate disk churn, prevent file-locking bottlenecks, and guarantee ACID reliability without introducing complex engineering overhead, FEAT-003 transitions the persistence layer to **SQLite** via Node 22 / Electron 45's native `node:sqlite` (`DatabaseSync`).

---

## 2. Core Constraints & Requirements

1. **Zero External Dependencies:** Use Node 22's built-in `node:sqlite` (`DatabaseSync`). Do NOT introduce `better-sqlite3`, `sqlite3`, or any library requiring native compilation via `node-gyp`.
2. **Zero ORM Overhead:** Use direct, parameterized SQL prepared statements.
3. **Targeted Single-Row Mutations:** Card rating updates must execute as targeted SQL statements (`UPDATE words SET box = ?, next_review_date = ? ... WHERE id = ?`), not full-table overwrites.
4. **WAL Mode & Durability:** Enable Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and synchronous normal mode.
5. **Seamless JSON Migration:** If `userData/vocab_library.json` is present and the SQLite database is uninitialized, automatically migrate all entries in a single transaction and rename the legacy file to `vocab_library.json.migrated`.
6. **Data Contract Preservation:** Preserve the exact schema and interface validated by `src/db/wordSchema.js`.

---

## 3. Database Schema

### Table: `words`
```sql
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
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
  
  box INTEGER NOT NULL DEFAULT 1,
  box_label TEXT NOT NULL DEFAULT 'Daily',
  next_review_date TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_rating TEXT,
  last_reviewed_at TEXT,
  interval_days REAL NOT NULL DEFAULT 1,

  meanings_json TEXT NOT NULL DEFAULT '[]',
  synonyms_json TEXT NOT NULL DEFAULT '[]',
  antonyms_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_words_due ON words(next_review_date);
CREATE INDEX IF NOT EXISTS idx_words_box ON words(box);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
CREATE INDEX IF NOT EXISTS idx_words_inflected ON words(inflected_form);
```

---

## 4. Acceptance Criteria (Gherkin)

### Scenario 1: Automatic Migration from JSON
```gherkin
Given an existing "vocab_library.json" with 3 words in userData
When StorageService initializes with an uninitialized "vocab_buddy.db"
Then all 3 words are imported into the SQLite database
And "vocab_library.json.migrated" exists
And querying words returns the exact 3 validated models
```

### Scenario 2: Single-Row Review Mutation
```gherkin
Given a word with id "serendipity_1" in Leitner Box 1
When reviewWord("serendipity_1", "good") is executed
Then only the matching row in "words" is updated
And its box is 2
And its box_label is "3 Days"
And other words in the database remain untouched
```

### Scenario 3: Point Insertion and Duplicate Rejection
```gherkin
Given a new word model for "halcyon"
When addWord is called
Then a single row is inserted into "words"
When addWord is called again with the same word
Then an error "Word already saved" is thrown
And no duplicate row is created
```

---

## 5. Handoff Checklist (Stage 1 -> Stage 2)

- [x] Architecture and schema designed without third-party ORMs or native compilation.
- [x] Gherkin acceptance criteria defined for Codex test coverage.
- [x] Implementation plan authored and ready for user sign-off.
- [x] Status set to `ready_for_backend`.


## 6. Stage 2 Backend Handoff

Implementation commit: `ddf23b1`.

- `src/db/schema.js` defines schema version one, the words table and all four
  requested indexes. A small `persistence_meta` table tracks migration completion.
- `StorageService` now uses native `node:sqlite` DatabaseSync, WAL, synchronous
  NORMAL, parameterized statements and explicit transactions. No dependencies added.
- `LibraryStore` delegates insertion, removal and review to targeted row mutations;
  it reads committed database state rather than retaining a stale whole-library copy.
- JSON migration imports validated entries atomically before renaming the source
  to `vocab_library.json.migrated`. A persistent pending marker makes post-commit
  rename failures recoverable on restart without duplicate imports. Existing backups
  are never overwritten. Invalid legacy data or corrupt/future databases fail
  without replacing the user's files; initialization can be retried after repair.
- Word models, nested JSON fields, audio metadata and IPC signatures are preserved.
  Missing legacy box labels and intervals receive compatible defaults. Empty
  libraries remain empty after restart. Full-library imports are atomic replacements.
- Verification: `npm test` (all five files), `npm run build`, `npm run lint`,
  individual JavaScript syntax checks, Python compilation and `git diff --check` pass.
  All 11 new SQLite tests pass both on Node 22.23.3 and Electron 45.2.1's Node
  24.22.1. Real headless Electron IPC-to-SQLite storage round-trip passes.
- Stage 3 integration can use the existing renderer-facing API. SQLite connections
  expose an idempotent `close()` for explicit lifecycle owners. Full UI/E2E release
  verification and the FEAT-002 frontend repairs remain separate Stage 4 work.
- Runtime note: Node 22.13+ loads `node:sqlite` without the experimental flag;
  earlier Node 22 versions need the flag. Electron 45 supplies the required runtime.
