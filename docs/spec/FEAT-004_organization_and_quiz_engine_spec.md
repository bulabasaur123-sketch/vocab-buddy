---
title: "Vocab Buddy: Organization Suite & Active Retention Quiz Engine (FEAT-004)"
type: prd_and_spec
feature_code: FEAT-004
status: backend_complete # draft | ready_for_backend | backend_complete | frontend_integrated | ready_to_ship
active_owner: gemini # gemini | codex | human
created_at: 2026-11-04
updated_at: 2026-11-04
---

# Feature Specification: FEAT-004 Organization Suite & Active Retention Quiz Engine

> **Feature Code:** FEAT-004  
> **Active Stage:** Stage 2 Complete — Ready for Frontend (Gemini Stage 3)  
> **Lead Architect (Stage 1 & 3):** Gemini  
> **Backend & Verification Lead (Stage 2 & 4):** Codex  
> **Repository:** `/home/zeto/Desktop/projects/Vocab Buddy`  
> **Obsidian Hub:** `/home/zeto/Documents/Obsidian Vault/Projects/Vocab Buddy/`  

---

## 1. Context & Motivation

Vocab Buddy provides a frictionless lookup vault and a Leitner 5-box spaced repetition deck. However, as readers accumulate hundreds of words, two critical capability gaps emerge:
1. **Categorical Organization:** Flat alphabetical or chronological lists lack contextual curation. Readers need to segment words by intended usage domain (e.g. *"Everyday Speech"*, *"Gothic & Classic Fiction"*, *"Professional & Technical"*) without the rigid silos of mutually exclusive folders.
2. **Active Retrieval Testing:** Passive flashcard flipping ("did I know this?") is subject to recognition bias. Introducing interactive quizzes (Definition Matching, Sentence Cloze, and Missing Letters) forces active neurological recall, accelerating vocabulary acquisition and anchoring memory.

---

## 2. Core Architecture & Constraints

1. **Native Persistence:** Continue using Node 22's built-in `node:sqlite` (`DatabaseSync`). Do NOT introduce ORMs, `better-sqlite3`, or any packages requiring native compilation (`node-gyp`).
2. **Relational Junction Design (Many-to-Many Collections):** Collections are modelled with a dedicated `collections` table and a `word_collections` junction table with `ON DELETE CASCADE`. A word can belong to 0, 1, or multiple collections.
3. **Normalized Semantic Tags:** Tags are stored in a dedicated `word_tags(word_id, tag)` junction table with lowercase normalization and indexed lookups, avoiding JSON array serialization overhead.
4. **Favorites Flag:** Words receive an indexed `is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1))` column.
5. **Hermetic Quiz Engine (`src/services/quizEngine.js`):**
   - Quiz distractors must be sampled dynamically from the local SQLite database in a single query (`ORDER BY RANDOM() LIMIT 3`) without loading all words into Node memory.
   - Sentence Cloze tests must leverage the existing example sentences stored in `meanings_json`.
   - Quiz completion can optionally update Leitner box progression (`vocab:review(id, 'good')` on correct, `vocab:review(id, 'again')` on failure).
6. **Backward Compatibility & Transactional Upgrades:** Existing SQLite databases (Version 2) must upgrade transactionally to Version 3 on startup without data loss.

---

## 3. Database Schema Migration (Version 2 $\rightarrow$ Version 3)

### Schema Definition:
```sql
-- 1. Upgrade words table
ALTER TABLE words ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_words_favorite ON words(is_favorite);

-- 2. Collections Table
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color_accent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);

-- 3. Word-Collections Junction Table
CREATE TABLE IF NOT EXISTS word_collections (
  word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (word_id, collection_id)
);
CREATE INDEX IF NOT EXISTS idx_wc_collection ON word_collections(collection_id);
CREATE INDEX IF NOT EXISTS idx_wc_word ON word_collections(word_id);

-- 4. Word-Tags Table
CREATE TABLE IF NOT EXISTS word_tags (
  word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (word_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_word_tags_tag ON word_tags(tag);
CREATE INDEX IF NOT EXISTS idx_word_tags_word ON word_tags(word_id);
```

---

## 4. Backend Contracts & Service Interfaces

### 4.1 `StorageService` (`src/services/storage.js`)

Codex will implement and export the following methods:

#### Favorites
* `toggleFavorite(id: string): boolean` — Toggles `is_favorite` ($0 \leftrightarrow 1$) for word `id`. Returns the new boolean state. Throws if word not found.
* `getFavorites(): Word[]` — Returns all words where `is_favorite = 1`.

#### Collections
* `createCollection(name: string, description?: string, colorAccent?: string): Collection` — Inserts collection. Generates `id: "col_" + Date.now() + "_" + rand`. Throws error if name is duplicate or empty.
* `getCollections(): Array<Collection & { wordCount: number }>` — Returns all collections with aggregated word counts.
* `deleteCollection(id: string): boolean` — Deletes collection and cascades removal of `word_collections` entries.
* `assignWordToCollection(wordId: string, collectionId: string): boolean` — Inserts junction row (`INSERT OR IGNORE`).
* `removeWordFromCollection(wordId: string, collectionId: string): boolean` — Deletes junction row.
* `getWordsInCollection(collectionId: string): Word[]` — Returns all words belonging to the collection.

#### Tags
* `setWordTags(wordId: string, tags: string[]): boolean` — Replaces all tags for `wordId` inside an explicit transaction. Tags must be lowercased and stripped of leading `#`.
* `getWordTags(wordId: string): string[]` — Returns tag list for given word.
* `getAllTags(): Array<{ tag: string, count: number }>` — Returns all distinct tags with counts.
* `getWordsByTag(tag: string): Word[]` — Returns all words with matching tag.

#### Word Model Hydration
* `loadWords()`, `getWords()`, `selectOne`: Updated so word models include hydrated:
  - `isFavorite: boolean`
  - `collections: string[]` (array of collection IDs or names)
  - `tags: string[]` (array of normalized strings)

---

### 4.2 `QuizEngine` (`src/services/quizEngine.js`)

A dedicated service taking `StorageService` or direct SQLite DB instance:

```javascript
class QuizEngine {
  constructor(storage) { ... }

  /**
   * Generates a 5 to 10 question quiz deck.
   * @param {('definition'|'cloze'|'missing_letters')} mode
   * @param {Object} [filter] - { collectionId, tag, limit }
   */
  generateQuiz(mode, { collectionId = null, tag = null, limit = 5 } = {})
}
```

#### Quiz Question Data Contracts:

1. **Mode 1: `'definition'` (Definition Match)**
```json
{
  "id": "q_123",
  "mode": "definition",
  "wordId": "serendipity_1",
  "prompt": "serendipity",
  "phonetic": "/ˌsɛr.ənˈdɪp.ɪ.ti/",
  "partOfSpeech": "noun",
  "correctAnswerIndex": 2,
  "options": [
    "A state of deep mental exhaustion or fatigue.",
    "A loud, confused, and noisy shouting.",
    "The faculty of making fortunate discoveries by accident.",
    "Showing exaggerated deference or servility."
  ]
}
```

2. **Mode 2: `'cloze'` (Sentence Fill-in-the-Blank)**
```json
{
  "id": "q_124",
  "mode": "cloze",
  "wordId": "taciturn_1",
  "promptSentence": "The old fisherman remained notoriously _______, refusing to explain what he saw on the reef.",
  "correctAnswerIndex": 0,
  "options": [
    "taciturn",
    "garrulous",
    "ephemeral",
    "obsequious"
  ]
}
```

3. **Mode 3: `'missing_letters'` (Spelling & Morphology)**
```json
{
  "id": "q_125",
  "mode": "missing_letters",
  "wordId": "obsequious_1",
  "maskedWord": "o b s _ q u _ o u s",
  "solution": "obsequious",
  "definition": "obedient or attentive to an excessive or submissive degree.",
  "phonetic": "/əbˈsiː.kwi.əs/"
}
```

---

### 4.3 IPC Bridge Contract (`src/services/ipc.js` & `preload.js`)

Codex must register these channels in `registerHandlers` and expose them in `preload.js`:

| Channel | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `vocab:favorite:toggle` | `(id: string)` | `boolean` | Toggles favorite state |
| `vocab:collections:list` | `()` | `Collection[]` | List all collections with counts |
| `vocab:collections:create` | `({ name, description, colorAccent })` | `Collection` | Create new collection |
| `vocab:collections:delete` | `(id: string)` | `boolean` | Delete collection |
| `vocab:collections:assign` | `(wordId: string, colId: string)` | `boolean` | Add word to collection |
| `vocab:collections:unassign`| `(wordId: string, colId: string)` | `boolean` | Remove word from collection |
| `vocab:tags:list` | `()` | `Array<{ tag, count }>` | List all tags with frequency |
| `vocab:tags:set` | `(wordId: string, tags: string[])` | `boolean` | Update tags for a word |
| `vocab:quiz:generate` | `(mode: string, filter?: object)` | `QuizDeck` | Generate quiz questions |
| `vocab:quiz:submit` | `(wordId: string, success: boolean, linkToSrs: boolean)` | `boolean` | Record result & update SRS |

---

## 5. Acceptance Criteria (Gherkin)

### Scenario 1: Favorite Toggle Persistence
```gherkin
Given a stored word with id "petrichor_1" and is_favorite = 0
When toggleFavorite("petrichor_1") is invoked
Then is_favorite becomes 1
And querying getFavorites() includes "petrichor_1"
When toggleFavorite("petrichor_1") is invoked again
Then is_favorite becomes 0
And querying getFavorites() does not include "petrichor_1"
```

### Scenario 2: Collection Membership and Cascade Deletion
```gherkin
Given a collection "Literature" created with id "col_lit"
And words "ephemeral_1" and "serendipity_1" assigned to "col_lit"
When getCollections() is called
Then "Literature" reports wordCount = 2
When deleteCollection("col_lit") is called
Then the collection is removed
And the words "ephemeral_1" and "serendipity_1" remain intact in the words table
And word_collections has 0 remaining rows referencing "col_lit"
```

### Scenario 3: Tag Normalization and Filtering
```gherkin
Given a word "taciturn_1"
When setWordTags("taciturn_1", ["#Archaic", " Latinate ", "dialogue"]) is called
Then getWordTags("taciturn_1") returns ["archaic", "latinate", "dialogue"]
And getAllTags() includes "archaic", "latinate", and "dialogue"
```

### Scenario 4: Quiz Engine Distractor Sampling
```gherkin
Given at least 4 words in the SQLite database
When generateQuiz("definition", { limit: 5 }) is called
Then each question contains 1 correct definition and 3 distinct distractor definitions
And no distractor is identical to the target word definition
And the target word id is accurately tracked
```

### Scenario 5: Sentence Cloze Extraction
```gherkin
Given a word "serendipity_1" with example sentence "A fortunate stroke of serendipity saved the expedition."
When generateQuiz("cloze", { limit: 5 }) is called
Then the prompt sentence replaces "serendipity" with "_______"
And the options list contains "serendipity" alongside 3 distractor words
```

### Scenario 6: Quiz SRS Feedback Integration
```gherkin
Given a word in Leitner Box 2
When a quiz question for that word is answered incorrectly with linkToSrs = true
Then the word is demoted to Leitner Box 1
And its next_review_at is scheduled for today
When a quiz question is answered correctly with linkToSrs = true
Then the word is promoted to Box 3
```

---

## 6. Handoff Checklist (Stage 1 $\rightarrow$ Stage 2)

- [x] Schema v3 designed with foreign keys, cascading deletes, and indexes.
- [x] Data contracts, IPC channels, and QuizEngine signatures fully specified.
- [x] Gherkin acceptance criteria defined for Codex test coverage.
- [x] Architecture verified to require zero native build dependencies.
- [x] Status set to `ready_for_backend`.
