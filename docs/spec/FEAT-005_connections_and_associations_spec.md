---
title: "Vocab Buddy: Connections & Reader-Authored Associations (FEAT-005)"
type: prd_and_spec
feature_code: FEAT-005
status: ready_for_backend # draft | ready_for_backend | backend_complete | frontend_integrated | ready_to_ship
active_owner: codex # gemini | codex | human
created_at: 2026-11-05
updated_at: 2026-11-05
---

# Feature Specification: FEAT-005 Connections & Reader-Authored Associations

> **Feature Code:** FEAT-005  
> **Active Stage:** Stage 1 Complete — Ready for Backend Implementation (Stage 2)  
> **Lead Architect (Stage 1 & 3):** Gemini  
> **Backend & Verification Lead (Stage 2 & 4):** Codex  
> **Repository:** `/home/zeto/Desktop/projects/Vocab Buddy`  

---

## 1. Vision & Problem Statement

Vocab Buddy’s primary promise is **“Your reading, remembered.”** As readers accumulate vocabulary from books, entries develop organic relationships: shared novel provenance, common thematic tags, shelf curations, and personal cognitive associations.

Currently, words are only browsable in isolated alphabetical or chronological lists/grids. **Connections** introduces a structured, exploratory **Word Map** centered around a selected word and its immediate relational neighborhood:

$$\text{Select word} \longrightarrow \text{Explore neighborhood hubs} \longrightarrow \text{Revisit reading context} \longrightarrow \text{Create personal associations}$$

### Non-Goals (Preserving Anti-Slop Discipline)
- **No full-graph cosmological chaos:** Do NOT attempt to render an unconstrained global graph of thousands of nodes with jittery perpetual physics.
- **No unexplainable "connection scores":** Do NOT invent arbitrary numerical affinity algorithms.
- **No pairwise combinatorial explosion:** 100 words in a book connect to a single **Source Hub**, NOT 4,950 pairwise edges.

---

## 2. Core Architecture & Backend Stack

1. **Database Engine:** Node 22 built-in `node:sqlite` (`DatabaseSync`) in WAL mode (`journal_mode = WAL`, `synchronous = NORMAL`). No native C++ addons or external ORMs.
2. **Schema Migration (Version 3 $\to$ Version 4):**
   - Introduce `word_associations` table for reader-created mutual connections.
   - Strict canonical ordering (`word_id_1 < word_id_2`) ensures each undirected association is stored exactly once without duplicates or self-links.
   - Cascading deletions (`ON DELETE CASCADE` on both endpoints).
3. **Bounded Relational Neighborhood Engine:**
   - Querying a word's neighborhood retrieves its primary record, connected source hub, tag hubs, shelf hubs, and direct personal associations.
   - Hub members beyond the immediate radius are strictly bounded with a count and an optional sample limit to ensure instant query performance ($< 5\text{ms}$).
4. **IPC Security & Validation:**
   - All association and neighborhood requests pass through frame origin verification (`trustedFrame`).
   - Inputs are strictly typed and sanitized; non-existent word IDs fail cleanly with actionable errors.

---

## 3. Database Schema Migration (Version 3 $\to$ Version 4)

In [`src/db/sqliteSchema.js`](file:///home/zeto/Desktop/projects/Vocab%20Buddy/src/db/sqliteSchema.js), increment `SCHEMA_VERSION = 4` and execute:

```sql
-- Schema Version 4: Word Associations
CREATE TABLE IF NOT EXISTS word_associations (
  word_id_1 TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  word_id_2 TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  note TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (word_id_1, word_id_2),
  CHECK (word_id_1 < word_id_2)
);

CREATE INDEX IF NOT EXISTS idx_word_assoc_1 ON word_associations(word_id_1);
CREATE INDEX IF NOT EXISTS idx_word_assoc_2 ON word_associations(word_id_2);
```

### Invariants & Rules:
- **Canonical Ordering:** For any two words $A$ and $B$, the pair is stored as `(min(A, B), max(A, B))`.
- **No Self-Links:** `CHECK (word_id_1 < word_id_2)` intrinsically guarantees $A \neq B$.
- **Cascading Referential Integrity:** If a word is deleted via `vocab:remove`, all its associations are deleted automatically by SQLite foreign key triggers.

---

## 4. Backend Service Contracts & IPC Channels

### A. Storage Service Methods ([`src/services/storage.js`](file:///home/zeto/Desktop/projects/Vocab%20Buddy/src/services/storage.js))

#### `addAssociation(wordId1, wordId2, note = '')`
- Canonicalizes IDs: `[idA, idB] = wordId1 < wordId2 ? [wordId1, wordId2] : [wordId2, wordId1]`.
- Rejects if `wordId1 === wordId2` or if either word does not exist in `words`.
- Inserts `(idA, idB, note, ISO_TIMESTAMP)`. If pair exists, updates `note`.
- Returns `{ success: true, association: { wordId1: idA, wordId2: idB, note } }`.

#### `removeAssociation(wordId1, wordId2)`
- Canonicalizes IDs and deletes row from `word_associations`.
- Returns `{ success: true }`.

#### `getAssociationsForWord(wordId)`
- Queries both `word_id_1 = ?` and `word_id_2 = ?`.
- Joins with `words` to return:
  ```json
  [
    {
      "associatedWordId": "w_xyz",
      "displayWord": "Dalliance",
      "word": "dalliance",
      "note": "Shared reading theme",
      "createdAt": "2026-11-05T12:00:00.000Z"
    }
  ]
  ```

#### `getConnectionsNeighborhood(wordId, sampleLimit = 10)`
- Evaluates the central word and its immediate hubs:
  1. **Center Node:** `{ id: word.id, type: 'word', label: word.displayWord, word: word.word, bookSource: word.bookSource, review: word.review }`.
  2. **Source Hub:** If `word.bookSource` is non-empty, creates a hub node `{ id: 'src:' + slug, type: 'source', label: word.bookSource, totalCount, sampleWords }`.
  3. **Tag Hubs:** For each tag in `word_tags`, creates `{ id: 'tag:' + tag, type: 'tag', label: '#' + tag, totalCount, sampleWords }`.
  4. **Shelf Hubs:** For each collection in `word_collections`, creates `{ id: 'shelf:' + id, type: 'shelf', label: name, totalCount, sampleWords }`.
  5. **Direct Associations:** Word nodes for all directly associated entries.
- Constructs a normalized `{ nodes, links }` graph model:
  ```json
  {
    "centerId": "w_123",
    "nodes": [
      { "id": "w_123", "type": "word", "label": "Ephemeral", "data": { ... } },
      { "id": "src:meditations", "type": "source", "label": "Meditations", "data": { "memberCount": 4 } },
      { "id": "w_456", "type": "word", "label": "Transient", "data": { ... } }
    ],
    "links": [
      { "source": "w_123", "target": "src:meditations", "type": "source" },
      { "source": "w_123", "target": "w_456", "type": "association", "note": "Similar mood" }
    ]
  }
  ```

### B. IPC Channels ([`src/services/ipc.js`](file:///home/zeto/Desktop/projects/Vocab%20Buddy/src/services/ipc.js))
- `vocab:associations:add` $\to$ `store.addAssociation(wordId1, wordId2, note)`
- `vocab:associations:remove` $\to$ `store.removeAssociation(wordId1, wordId2)`
- `vocab:associations:list` $\to$ `store.getAssociationsForWord(wordId)`
- `vocab:connections:neighborhood` $\to$ `store.getConnectionsNeighborhood(wordId, limit)`

### C. Preload Expositions ([`preload.js`](file:///home/zeto/Desktop/projects/Vocab%20Buddy/preload.js))
Expose on `window.vocabAPI`:
- `addAssociation: (wordId1, wordId2, note) => ipcRenderer.invoke('vocab:associations:add', wordId1, wordId2, note)`
- `removeAssociation: (wordId1, wordId2) => ipcRenderer.invoke('vocab:associations:remove', wordId1, wordId2)`
- `getAssociations: (wordId) => ipcRenderer.invoke('vocab:associations:list', wordId)`
- `getConnectionsNeighborhood: (wordId, limit) => ipcRenderer.invoke('vocab:connections:neighborhood', wordId, limit)`

---

## 5. Acceptance Criteria (Gherkin Scenarios for Stage 2)

```gherkin
Feature: Word Associations and Connections Neighborhood Extraction

  Scenario: Upgrading database to Version 4 creates association tables
    Given an existing Version 3 database
    When initializeSchema runs
    Then PRAGMA user_version equals 4
    And the table word_associations exists with foreign key constraints

  Scenario: Adding mutual personal associations
    Given two existing words "Ephemeral" and "Dalliance"
    When addAssociation is invoked with a contextual note
    Then a record is persisted in canonical order word_id_1 < word_id_2
    And querying associations for "Ephemeral" returns "Dalliance"
    And querying associations for "Dalliance" returns "Ephemeral"

  Scenario: Preventing self-associations and duplicates
    Given an existing word "Serendipity"
    When addAssociation is invoked with identical IDs
    Then an error is thrown and no record is inserted
    When the same valid pair is added twice
    Then the operation is idempotent and updates the note without error

  Scenario: Cascade deletion on word removal
    Given words "A" and "B" with an association
    When word "A" is removed from the lexicon
    Then the corresponding association in word_associations is deleted
    And word "B" remains unaffected

  Scenario: Extracting bounded connections neighborhood
    Given a word "Mellifluous" with book source "Dorian Gray", tag "sensory", and an associated word "Dulcet"
    When getConnectionsNeighborhood is invoked for "Mellifluous"
    Then the payload contains the center node "Mellifluous"
    And a source hub node "Dorian Gray" with link type "source"
    And a tag hub node "#sensory" with link type "tag"
    And an association node "Dulcet" with link type "association"
    And hub sample members do not exceed the requested limit
```

---

## 6. Handoff Protocol
- Status set to `ready_for_backend`.
- Stage 2 Owner: **Codex**.
- Tasks for Codex: Implement SQLite migration v4, storage methods, IPC routes, preload bindings, and unit tests (`src/test/connections.test.js`) ensuring all 64+ tests pass.


## Stage 2 Contract Clarifications
- `sampleLimit` defaults to 10; only integers from 0 through 100 are accepted. Hub counts include the center; samples contain `{ id, word, displayWord }`, ordered by ID, and may include the center.
- Graph nodes expose the listed top-level metadata and the example's `data` object. Hub `data.memberCount` equals `totalCount`.
- Source hub IDs use `src:` plus the URI-encoded exact book source to avoid slug collisions. Blank sources produce no hub.
- All direct personal associations are returned; only hub samples are limited. Missing center/list IDs throw `Word not found`. Removing an absent valid pair succeeds.
- Pair ordering uses SQLite-compatible UTF-8 byte order; updating a note preserves `createdAt`.
