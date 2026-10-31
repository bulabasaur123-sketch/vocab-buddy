---
title: "Vocab Buddy: Smart Reading Vocabulary & Spaced Repetition Companion"
type: prd_and_spec
feature_code: FEAT-001
status: ready_for_backend # draft | ready_for_backend | backend_complete | frontend_integrated | ready_to_ship
active_owner: codex # gemini | codex | human
created_at: 2026-10-31
updated_at: 2026-10-31
---

# Feature Specification: Vocab Buddy Core Backend & Enrichment Engine

> **Feature Code:** FEAT-001  
> **Active Stage:** Ready for Backend (Stage 2)  
> **Lead Architect (Stage 1 & 3):** Gemini  
> **Backend & Review Lead (Stage 2 & 4):** Codex  
> **Repository:** `/home/zeto/Desktop/projects/Vocab Buddy`  
> **Obsidian Hub:** `/home/zeto/Documents/Obsidian Vault/Projects/Vocab Buddy/`  

---

## 1. Executive Summary & Problem Statement

* **User Problem:** When reading books, the user frequently encounters unfamiliar English words. Manually opening search engines or dictionaries to copy definitions, identify parts of speech, research historical etymology/word roots, and craft example sentences creates excessive friction and interrupts the flow of reading.
* **Proposed Solution:** Build **Vocab Buddy**, a distraction-free desktop application. The user simply types or pastes the word (with an optional book title) and hits enter. The system automatically fetches:
  1. IPA phonetic transcription and native `.mp3` audio pronunciation.
  2. Grammatical classifications (noun, verb, adjective, etc.) and definitions with contextual examples.
  3. Deep etymology and historical language roots (Latin, Greek, Old English, coinage year/author).
  4. Synonyms and related words.
  5. Local disk persistence with an SM-2 / Leitner spaced-repetition flashcard queue.
* **Target Personas:** Avid book readers, students, and writers who want friction-free vocabulary acquisition and retention.

---

## 2. Scope Boundaries

### In Scope for Codex (Stage 2 Backend)
* **Dictionary Service (`src/services/dictionary.js`)**:
  * Parallel querying of Free Dictionary API (`api.dictionaryapi.dev/api/v2/entries/en/{word}`) and Wiktionary REST API (`en.wiktionary.org/w/api.php?action=parse&page={word}&prop=text&format=json`).
  * Robust HTML stripping and Wiktionary parsing to extract the clean **Etymology** section.
  * Audio extraction prioritized by standard dialect (`-us.mp3` or `-uk.mp3`).
  * IPA phonetic extraction from dictionary API with fallback to Wiktionary `<span class="IPA">` tags.
  * Comprehensive error handling for missing words, misspellings, or rate limits.
* **Spaced Repetition Engine (`src/services/spacedRepetition.js`)**:
  * Leitner 5-box spaced repetition algorithm (`calculateNextReview`, `isDueForReview`, `getReviewStats`, `getDueWordsQueue`).
  * Ratings: `again` (reset to Box 1, 1 day), `hard` (current box, 1-2 days), `good` (box + 1, interval * 2.5), `easy` (box + 2, interval * 4).
* **Storage Persistence (`src/services/storage.js`)**:
  * Local JSON file persistence in user directory (`userData/vocab_library.json`).
  * Safe directory creation, corrupted JSON recovery, export/import support, and bundled starter seed data.
* **Desktop Infrastructure (Electron)**:
  * `package.json` with scripts (`npm start`, `npm test`) and `--no-sandbox` Linux flags.
  * `main.js`: BrowserWindow lifecycle, IPC handlers for storage and dictionary lookups.
  * `preload.js`: Secure context-isolated bridge exposing `window.vocabAPI`.
* **Automated Test Suite (`test/*.test.js`)**:
  * Comprehensive hermetic unit tests using Node.js built-in test runner (`node --test`).

### Out of Scope (Deferred to Stage 3 - Gemini Frontend)
* Visual HTML layout, CSS design tokens, animations, and typography (`index.html`, `src/styles/main.css`).
* Frontend DOM controller and view-switcher logic (`src/renderer.js`).

---

## 3. Data Contracts & Architecture (For Codex - Stage 2)

### 3.1 Data Models & Schemas

```typescript
export interface ReviewData {
  box: number;               // 1 to 5 (5 = Mastered)
  nextReviewDate: string;    // ISO 8601 Timestamp
  reviewCount: number;       // Total times reviewed
  streak: number;            // Consecutive correct recalls
  lastRating: 'again' | 'hard' | 'good' | 'easy' | null;
  lastReviewedAt: string | null; // ISO 8601 Timestamp
  intervalDays?: number;
}

export interface DefinitionItem {
  definition: string;
  example: string;
}

export interface MeaningGroup {
  partOfSpeech: string;      // e.g. "noun", "verb", "adjective"
  definitions: DefinitionItem[];
}

export interface WordModel {
  id: string;                // e.g. "serendipity_1793451831392"
  word: string;              // Lowercase trimmed key, e.g. "serendipity"
  displayWord: string;       // Capitalized, e.g. "Serendipity"
  phonetic: string;          // IPA, e.g. "/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/"
  audioUrl: string;          // Direct URL to .mp3, or empty string
  etymology: string;         // Human-readable origin text from Wiktionary
  meanings: MeaningGroup[];
  synonyms: string[];        // Array of up to 8 top synonyms
  antonyms: string[];        // Array of up to 5 antonyms
  bookSource: string;        // Optional user context, e.g. "Dune"
  createdAt: string;         // ISO 8601 Timestamp
  review: ReviewData;
}

export interface LibraryPayload {
  version: string;           // "1.0"
  updatedAt: string;         // ISO 8601 Timestamp
  words: WordModel[];
}
```

### 3.2 Service API Signatures

#### Dictionary Service (`src/services/dictionary.js`)
```javascript
/**
 * Looks up a word against Free Dictionary and Wiktionary APIs in parallel.
 * @param {string} rawWord - Word to search.
 * @param {string} [bookSource] - Optional book or chapter context.
 * @returns {Promise<WordModel>} Fully enriched word object.
 * @throws {Error} If word cannot be found or network fails.
 */
async function lookupWord(rawWord, bookSource = '') { ... }

/**
 * Strips HTML tags, script/styles, and decodes HTML entities.
 * @param {string} html
 * @returns {string} Plain text.
 */
function cleanHtmlText(html) { ... }

/**
 * Parses Wiktionary HTML to isolate the Etymology section.
 * @param {string} html
 * @returns {string|null} Clean etymology paragraph or null.
 */
function extractWiktionaryEtymology(html) { ... }
```

#### Spaced Repetition Engine (`src/services/spacedRepetition.js`)
```javascript
/**
 * Calculates updated Leitner review metrics.
 * @param {ReviewData} reviewData
 * @param {'again'|'hard'|'good'|'easy'} rating
 * @param {Date} [now]
 * @returns {ReviewData}
 */
function calculateNextReview(reviewData, rating, now = new Date()) { ... }

/**
 * Returns true if word's nextReviewDate is <= now.
 */
function isDueForReview(word, now = new Date()) { ... }

/**
 * Computes summary review counts.
 * @returns {{ total: number, due: number, mastered: number, learning: number }}
 */
function getReviewStats(words, now = new Date()) { ... }
```

#### Storage Service (`src/services/storage.js`)
```javascript
class StorageService {
  constructor(storageDir, autoSeed = true) { ... }
  loadWords(): WordModel[] { ... }
  saveWords(words: WordModel[]): boolean { ... }
  exportData(): WordModel[] { ... }
  importData(words: WordModel[]): boolean { ... }
}
```

---

## 4. Acceptance Criteria (Gherkin Format)

### Scenario 1: Enriching a standard English word
```gherkin
Given the user enters the word "serendipity" and book "The Three Princes of Serendip"
When the dictionary lookup service executes
Then it returns an enriched WordModel object
And word is "serendipity"
And phonetic is not empty (e.g. "/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/")
And audioUrl points to a playable .mp3 audio file
And etymology contains "From Serendip" and mentions "Horace Walpole"
And meanings contains at least one noun definition
And review is initialized to Leitner Box 1
```

### Scenario 2: Handling words with Wiktionary-only etymology
```gherkin
Given a word whose Free Dictionary entry lacks detailed historical etymology
When the Wiktionary parser processes the page HTML
Then it extracts the paragraph immediately following the "Etymology" heading
And strips all HTML formatting, spans, and links
And returns clean human-readable etymology text
```

### Scenario 3: Spaced Repetition Interval Scheduling
```gherkin
Given a word in Leitner Box 1 with streak 0
When the user rates recall as "good"
Then the word advances to Box 2
And streak increases to 1
And nextReviewDate is scheduled 3 days into the future

Given a word in Leitner Box 4 with streak 4
When the user rates recall as "again"
Then the word resets to Box 1
And streak resets to 0
And nextReviewDate is scheduled for 1 day into the future
```

### Scenario 4: Local File Storage & Persistence
```gherkin
Given an empty user data directory
When StorageService initializes
Then it creates the storage folder and loads existing or seed data
And subsequent calls to saveWords persist the updated word array to "vocab_library.json"
```

---

## 5. UI/UX Guidelines (For Stage 3 - Gemini Frontend)

* **Design Philosophy:** Luxury dark-mode first aesthetic (`#090d16` canvas, `#111827` elevated cards, `#6366f1` / `#10b981` glowing accents).
* **Typography:** `Outfit` (headings, display words) + `Inter` (readable UI & definitions).
* **Key Components:**
  * Floating Quick-Add input bar with loading state.
  * Word card grid with part-of-speech badge, audio playback button, and book tag.
  * 3D flippable flashcard view with keyboard shortcuts (<kbd>Space</kbd> to flip, <kbd>1</kbd>-<kbd>4</kbd> to grade).
  * Word detail modal and backup exporter.

---

## 6. Handoff Checklist (Stage 1 -> Stage 2)

- [x] Problem statement, personas, and scope documented.
- [x] Exact data models and TypeScript/JavaScript interfaces defined.
- [x] API contracts for dictionary, Wiktionary, spaced repetition, and storage finalized.
- [x] Gherkin acceptance criteria specified for Codex unit tests.
- [x] Project workspace initialized via `init-triad.sh` with `AGENTS.md`.
- [x] Status set to `ready_for_backend` and owner assigned to `codex`.

**Handoff Command for Developer:**
> Prompt Codex: *"Implement FEAT-001 backend services and tests per `docs/spec/FEAT-001_vocab_buddy_spec.md`."*
