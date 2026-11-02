---
title: "Vocab Buddy: Root Lemmatization, Lightweight Audio & Leitner Context"
type: prd_and_spec
feature_code: FEAT-002
status: frontend_integrated # draft | ready_for_backend | backend_complete | frontend_integrated | ready_to_ship
active_owner: codex # gemini | codex | human
created_at: 2026-11-02
updated_at: 2026-11-02
---

# Feature Specification: FEAT-002 Root Lemmatization, Lightweight Audio & Leitner Context

> **Feature Code:** FEAT-002  
> **Active Stage:** Frontend Integrated — Ready for Stage 4 Code Review & Security Gate  
> **Lead Architect (Stage 1 & 3):** Gemini  
> **Backend & Review Lead (Stage 2 & 4):** Codex  
> **Repository:** `/home/zeto/Desktop/projects/Vocab Buddy`  
> **Obsidian Hub:** `/home/zeto/Documents/Obsidian Vault/Projects/Vocab Buddy/`  

---

## 1. Executive Summary & Problem Statement

Users of Vocab Buddy have raised three practical friction points during reading sessions:

1. **Inflected Forms Lack Data:** When readers note down words in past-tense (*stymied*), gerund (*eking*), or plural forms (*beauties*), dictionary databases return empty phonetics (`"phonetics": []`), missing audio tracks, and sparse etymology because public lexicons index information under the root headword (*stymie*, *eke*, *beauty*).
2. **Audio Unreliability & Weight:** Audio playback fails silently when an MP3 is missing from the API because Electron on Linux lacks system TTS speech-dispatcher voices. Readers need guaranteed, lightweight audio clips (15KB–35KB) that are downloaded once, stored locally, and work offline without system dependencies.
3. **Cryptic Leitner Pill Badges:** Badges displaying `"Box 1"` read as technical jargon. Readers lack immediate context about what Box 1 through Box 5 mean, what the memory schedule is, and how recall grading advances words toward permanent mastery.

---

## 2. Scope Boundaries

### In Scope for Codex (Stage 2 Backend)
1. **Root Lemma Resolution (`src/services/dictionary.js`)**:
   - Detect when an input word is inflected (via Free Dictionary `sourceUrls`, Wiktionary `<span class="form-of-definition-link">`, or algorithmic suffix rules).
   - If an inflection is detected, automatically query the root headword and record the root word as the canonical vocabulary entry.
   - Retain the user's original query as `inflectedForm` (e.g. `word: "stymie"`, `inflectedForm: "stymied"`).
2. **Lightweight Audio Cache & Storage (`src/services/audioStorage.js`)**:
   - Inherit root word audio for inflected words.
   - Fallback to Wiktionary/Wikimedia audio tags (`<audio><source src="//upload.wikimedia.org/.../en-us-{word}.ogg">`) if the primary dictionary API lacks an audio track.
   - Fetch and cache the audio clip locally in `userData/audio/{word}.mp3` (strictly enforcing a 100KB maximum size to guarantee lightweight storage).
   - Expose local audio file URL or data URL through safe IPC.
3. **Leitner Review Cadence Labels (`src/services/spacedRepetition.js`)**:
   - Update `calculateNextReview` and word review data to compute human-readable intervals and labels:
     - Box 1: `Daily` (1 day)
     - Box 2: `3 Days` (3 days)
     - Box 3: `Weekly` (7 days)
     - Box 4: `Fortnightly` (14 days)
     - Box 5: `Mastered` (30 days)
   - Include `boxLabel` in `ReviewData` object.
4. **Automated Unit Tests (`src/test/*.test.js`)**:
   - Tests verifying root resolution for `stymied` ➔ `stymie` and `eking` ➔ `eke`.
   - Tests verifying audio downloading, file size limits (<100KB), and local cache retrieval.
   - Tests verifying `boxLabel` schedule computations.

### In Scope for Gemini (Stage 3 Frontend Integration)
1. **Lexicon Card Template Updates (`src/renderer.js` & `index.html`)**:
   - Display root word as primary title with subtitle: *"Encountered as: stymied"*.
   - Replace plain `Box 1` badge with descriptive stamp: `Box 1 · Daily`.
2. **Retention Cadence Guide Dialog**:
   - Add a clean, editorial modal explaining the 5 Leitner boxes, memory science intervals, and review button triggers.
3. **Audio Playback Refinement**:
   - Play from cached local audio path. Gracefully disable button if no public recording exists, displaying an informative tooltip.

---

## 3. Data Contracts & Architecture (For Codex - Stage 2)

### 3.1 Data Model Updates

```typescript
export interface ReviewData {
  box: number;               // 1 to 5
  boxLabel: string;          // "Daily" | "3 Days" | "Weekly" | "Fortnightly" | "Mastered"
  nextReviewDate: string;    // ISO 8601 Timestamp
  reviewCount: number;
  streak: number;
  lastRating: 'again' | 'hard' | 'good' | 'easy' | null;
  lastReviewedAt: string | null;
  intervalDays?: number;
}

export interface WordModel {
  id: string;                // e.g. "stymie_1793451831392"
  word: string;              // Root lemma (e.g. "stymie")
  displayWord: string;       // "Stymie"
  inflectedForm?: string;    // "stymied" (if entered as inflected)
  phonetic: string;          // e.g. "/ˈstaɪmi/"
  audioUrl: string;          // Remote URL
  audioLocalPath?: string;   // Local relative path in userData/audio/
  audioSizeBytes?: number;   // File size in bytes (e.g. 18432)
  etymology: string;
  meanings: MeaningGroup[];
  synonyms: string[];
  antonyms: string[];
  bookSource: string;
  createdAt: string;
  review: ReviewData;
}
```

### 3.2 Service API Signatures

#### Dictionary Service (`src/services/dictionary.js`)
```javascript
/**
 * Detects if a queried word is an inflected form and extracts its root lemma.
 * @param {string} word - Lowercase word.
 * @param {object} dictData - Response from Free Dictionary API.
 * @param {string} wikiHtml - HTML from Wiktionary parse API.
 * @returns {string|null} Root word or null if already a root/unidentified.
 */
function resolveRootLemma(word, dictData, wikiHtml) { ... }

/**
 * Enhanced lookup: resolves root words, inherits phonetics/audio, and notes inflected form.
 */
async function lookupWord(rawWord, bookSource = '') { ... }
```

#### Audio Cache Service (`src/services/audioStorage.js`)
```javascript
class AudioStorageService {
  constructor(audioDir) { ... }
  
  /**
   * Downloads and caches an audio URL locally if under maxSizeBytes.
   * @param {string} word
   * @param {string} remoteUrl
   * @param {number} [maxSizeBytes=102400] Default 100KB limit
   * @returns {Promise<{ localPath: string, sizeBytes: number }|null>}
   */
  async cacheAudio(word, remoteUrl, maxSizeBytes = 102400) { ... }

  /**
   * Gets absolute path of cached audio file.
   */
  getLocalAudioPath(word): string | null { ... }
}
```

#### Spaced Repetition (`src/services/spacedRepetition.js`)
```javascript
const BOX_METRICS = {
  1: { intervalDays: 1, label: 'Daily' },
  2: { intervalDays: 3, label: '3 Days' },
  3: { intervalDays: 7, label: 'Weekly' },
  4: { intervalDays: 14, label: 'Fortnightly' },
  5: { intervalDays: 30, label: 'Mastered' }
};

function calculateNextReview(reviewData, rating, now = new Date()) {
  // Returns updated ReviewData including new boxLabel
}
```

---

## 4. Acceptance Criteria (Gherkin Format)

### Scenario 1: Inflected word resolves to root lemma
```gherkin
Given the user enters the inflected word "stymied"
When the dictionary lookup service executes
Then the canonical word is resolved to "stymie"
And the displayWord is "Stymie"
And inflectedForm is preserved as "stymied"
And phonetic is populated with the root pronunciation "/ˈstaɪmi/"
And audioUrl points to the root audio clip "stymie-us.mp3"
```

### Scenario 2: Lightweight audio caching
```gherkin
Given a valid remote pronunciation audio URL of 22KB
When the audio storage service caches the audio for "stymie"
Then it downloads the file into the user data audio directory
And audioSizeBytes is recorded as 22528
And the file size does not exceed the 100KB lightweight threshold
```

### Scenario 3: Oversized audio rejection
```gherkin
Given a remote audio URL exceeding 100KB in size
When the audio cache service attempts to store it
Then the download is rejected to protect disk storage
And audioLocalPath remains undefined
```

### Scenario 4: Leitner box labels
```gherkin
Given a word in Leitner Box 1
When calculateNextReview processes a "good" rating
Then the box advances to 2
And boxLabel is set to "3 Days"
And intervalDays is set to 3

Given a word advancing to Leitner Box 5
Then boxLabel is set to "Mastered"
And intervalDays is set to 30
```

---

## 5. Handoff Checklist (Stage 1 -> Stage 2)

- [x] Root lemma resolution strategy defined (FreeDict `sourceUrls` + Wiktionary `form-of` + suffix heuristics).
- [x] Lightweight audio caching architecture specified (<100KB limit, local offline cache in `userData/audio/`).
- [x] Leitner box labels and interval semantics documented for UI clarity.
- [x] TypeScript interfaces and service signatures finalized.
- [x] Gherkin acceptance criteria formulated for Codex unit tests.
- [x] Status set to `ready_for_backend` and owner assigned to `codex`.

**Handoff Command for Developer:**
> Prompt Codex: *"Codex, please implement the backend services, root lemma resolution, audio caching, and tests for FEAT-002 per `docs/spec/FEAT-002_root_lemmatization_audio_leitner_spec.md`."*


## Stage 2 Backend Handoff

- Implementation committed as `1dc587e`.
- Root lookup preserves `inflectedForm`, inherits canonical pronunciation and meanings,
  and bounds resolution to five unique headwords. Suffix rules are heuristic.
- Audio cache enforces a 102400-byte maximum and exposes cached recordings through
  `window.vocabAPI.getAudioDataUrl(word.word)`. Missing recordings return null.
- Cache filenames follow `{word}.mp3`; Wikimedia Ogg/WAV bytes retain their original
  encoding, with the correct MIME type supplied by the data URL bridge.
- Existing libraries gain box labels on load without rescheduling existing dates.
- Verified: `npm test`, `npm run build`, `npm run lint`, individual JavaScript
  syntax checks, and `git diff --check`. Network providers use injected fixtures;
  live audio playback remains part of frontend integration verification.
- Gemini owns the next stage: canonical titles, encountered-form subtitles,
  cadence badges/guide, and cached audio playback.

---

## 6. Stage 3 Frontend Integration (Gemini Complete)

- [x] **Encountered Form Display:** Cards in the lexicon grid, review front/back faces, and detail modal display the subtle citation `Encountered as: <inflectedForm>` when an inflected word was logged.
- [x] **Lightweight Audio Cache Playback:** `playAudio` queries `window.vocabAPI.getAudioDataUrl(wordText)` via IPC before falling back to remote URLs or speech synthesis.
- [x] **Leitner Cadence Context & Labels:** Box stamps across the application display the cadence interval (`Box 1 · Daily`, `Box 2 · 3 Days`, `Box 3 · Weekly`, `Box 4 · Fortnightly`, `Box 5 · Mastered`).
- [x] **Cadence Guide Modal:** Implemented editorial modal dialog explaining all 5 memory tiers, interval durations, and keyboard rating impact (`1: Again`, `2: Hard`, `3: Good`, `4: Easy`). Accessible via masthead button `#btn-cadence-guide` or by clicking any box badge stamp.
- [x] **Inflected Word Search:** Searching an inflected form like `stymied` matches the canonical root card `Stymie`.
- [x] **Editorial Antislop Design:** Ink & Paper styling maintained with zero flashy neon gradients or marketing copy.

---

## 7. Stage 4 Handoff Checklist (Gemini -> Codex)

- [ ] Security audit: verify base64 audio data URL handling, IPC validation, and path traversal safety on cache.
- [ ] Code review: inspect frontend and backend diffs for edge cases, performance, or memory leaks.
- [ ] Verification suite: execute `npm test`, `npm run lint`, and `npm run build`.
- [ ] Update status to `ready_to_ship`.

**Handoff Command for Developer:**
> Prompt Codex: *"Codex, please conduct the Stage 4 Security Review, Quality Audit, and Full Verification for FEAT-002 per `docs/spec/FEAT-002_root_lemmatization_audio_leitner_spec.md`."*

