---
title: "Wordloom: Web Platform, Cloudflare Deployment & Peer Feedback Companion (FEAT-007)"
type: prd_and_spec
feature_code: FEAT-007
status: ready_for_backend # draft | ready_for_backend | backend_complete | frontend_integrated | ready_to_ship
active_owner: codex # gemini | codex | human
created_at: 2026-11-07
updated_at: 2026-11-07
---

# Feature Specification: FEAT-007 Web Platform, Cloudflare Deployment & Peer Feedback

> **Feature Code:** FEAT-007  
> **Active Stage:** Stage 1 Complete — Ready for Backend Implementation  
> **Lead Architect (Stage 1 & 3):** Gemini  
> **Backend & Verification Lead (Stage 2 & 4):** Codex  
> **Repository:** `/home/zeto/Desktop/projects/Vocab Buddy`  
> **Deployment Target:** Cloudflare Pages (`https://wordloom.pages.dev`)  

---

## 1. Vision & Problem Statement

Wordloom has evolved into a full-featured personal reading sanctum featuring SQLite persistence, audio lemmatization, Leitner spaced repetition, associative connections maps, and an MV3 browser extension companion.

However, sharing the application with peers for qualitative critique and user feedback currently requires distributing compiled desktop binaries (`.deb`, `.exe`) or instructing reviewers to install Node.js and run `npm start`. This friction prevents 90% of prospective reviewers from experiencing the product.

**FEAT-007 transforms Wordloom into a dual-mode application:**
1. **Desktop Native (Electron):** Retains its existing high-performance local SQLite backend, native OS audio caching, and stdio native messaging bridge.
2. **Web Native (Cloudflare Pages):** Runs directly in any modern browser on mobile, tablet, or desktop with zero installation, zero authentication barriers, client-side persistence, real-time dictionary enrichment, and a built-in peer feedback system.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WORDLOOM DUAL-MODE VISION                       │
│                                                                        │
│   DESKTOP (Electron)                           WEB (Cloudflare Pages)  │
│   • Local SQLite (vocab_buddy.db)              • Client Storage (WebAdapter)
│   • Native stdio Messaging Bridge              • Direct HTTPS REST Lookups│
│   • Offline Audio Filesystem Cache             • HTML5 Web Audio Playback │
│   • Fixed Desktop UI Shell                     • Touch-Ready Responsive UI│
│                                                • In-App Peer Feedback Hub │
└────────────────────────────────────────────────────────────────────────┘
```

### Non-Goals (Anti-Slop Discipline & Privacy Protections)
- **No heavy framework rewrites:** Do NOT rewrite the frontend in React, Vue, or Next.js. Retain the fast, zero-dependency vanilla JavaScript and semantic HTML5 design system (`DESIGN.md`).
- **No mandatory authentication walls:** Do NOT force peers to register, sign in, or provide an email before testing the application. First-time web visitors immediately drop into a curated, interactive showcase library.
- **No invasive tracking or analytics scripts:** Do NOT load Google Analytics, tracking beacons, or third-party behavioral trackers.
- **No loss of desktop capability:** The web adapter MUST conform exactly to the 28-method interface of `window.vocabAPI` so that not a single line of desktop code is broken or degraded.

---

## 2. Architecture & Runtime Boundaries

### 2.1 The Polymorphic API Facade (`window.vocabAPI`)

The entire desktop frontend interacts with the system exclusively through `window.vocabAPI`. 

In `FEAT-007`, the application runtime detects its hosting environment:

```
                      ┌───────────────────────────────┐
                      │    Wordloom UI Application    │
                      │  (renderer.js, desktop.js,    │
                      │      connectionsView.js)      │
                      └───────────────┬───────────────┘
                                      │ calls window.vocabAPI
                                      ▼
                      ┌───────────────────────────────┐
                      │   Environment Detection Gate  │
                      └───────┬───────────────┬───────┘
            Electron Present? │               │ Running in Web Browser?
            (window.vocabAPI) │               │ (!window.vocabAPI)
                              ▼               ▼
           ┌───────────────────────┐     ┌────────────────────────┐
           │      preload.js       │     │   webAdapter.js (NEW)  │
           │  (IPC to main.js and  │     │ (Local-first browser   │
           │    Node.js SQLite)    │     │  storage + REST APIs)  │
           └───────────────────────┘     └────────────────────────┘
```

1. **When running in Electron:** `preload.js` initializes `window.vocabAPI` before DOM scripts execute. `webAdapter.js` detects the existing instance and gracefully stands down.
2. **When running on the Web (Cloudflare Pages):** `webAdapter.js` executes first, detects that `window.vocabAPI` is missing, and dynamically mounts a full client-side implementation of all 28 API methods on `window.vocabAPI`.

---

## 3. Data Contracts & Web Adapter Specifications

`src/services/webAdapter.js` must implement all 28 methods exposed in `preload.js`:

### 3.1 Vocabulary & Storage Methods
| Method | Signature | Web Behavior |
| :--- | :--- | :--- |
| `loadWords()` | `() => Promise<Word[]>` | Reads `wordloom_words` from `localStorage` or `IndexedDB`. If empty, seeds with showcase starter words. |
| `saveWords(words)` | `(words: Word[]) => Promise<Word[]>` | Writes to browser storage. |
| `addWord(word)` | `(word: Word) => Promise<Word>` | Appends to stored collection; validates unique IDs. |
| `removeWord(id)` | `(id: string) => Promise<void>` | Filters word and cascades cleanup to collections, tags, and associations. |
| `reviewWord(id, rating)` | `(id: string, rating: Rating) => Promise<Word>` | Invokes Leitner logic from `spacedRepetition.js` and updates card cadence. |
| `getReviewStats()` | `() => Promise<ReviewStats>` | Computes aggregate counts (due, learned, mastered) across stored cards. |
| `getDueWordsQueue()` | `() => Promise<Word[]>` | Returns cards where `nextReviewDate <= now`, ordered oldest first. |
| `exportData()` | `() => Promise<LibraryExport>` | Serializes words, collections, tags, and associations to a JSON download. |
| `importData(payload)` | `(payload: LibraryExport) => Promise<Word[]>` | Validates schema and replaces client library state. |

### 3.2 Linguistic & Audio Methods
| Method | Signature | Web Behavior |
| :--- | :--- | :--- |
| `lookupWord(word, source)` | `(word: string, source?: string) => Promise<Word>` | Performs client-side HTTPS `fetch()` to `https://api.dictionaryapi.dev/api/v2/entries/en/<word>` and Wiktionary API, lemmatizes headwords, and formats a canonical `Word` model. |
| `getAudioDataUrl(word)` | `(word: string) => Promise<string \| null>` | Returns direct HTTPS audio URL from dictionary enrichment or cached blob. |
| `ensurePronunciation(word)` | `(word: string) => Promise<AudioStatus>` | Verifies audio URL accessibility and returns status. |
| `repairPronunciations()` | `() => Promise<RepairResult>` | Validates all library audio links. |

### 3.3 Organizations, Collections & Quizzes
| Method | Signature | Web Behavior |
| :--- | :--- | :--- |
| `getCollections()` | `() => Promise<Collection[]>` | Reads shelves from browser storage. |
| `createCollection(col)` | `(col: Collection) => Promise<Collection>` | Stores new shelf. |
| `deleteCollection(id)` | `(id: string) => Promise<void>` | Deletes shelf and unassigns member words. |
| `assignWordToCollection(wordId, colId)` | `(wId, cId) => Promise<void>` | Appends shelf association. |
| `removeWordFromCollection(wordId, colId)` | `(wId, cId) => Promise<void>` | Removes shelf association. |
| `getAllTags()` | `() => Promise<string[]>` | Aggregates unique tags. |
| `setWordTags(id, tags)` | `(id, tags) => Promise<void>` | Updates tags for a specific word. |
| `toggleFavorite(id)` | `(id: string) => Promise<boolean>` | Inverts `isFavorite` flag. |
| `generateQuiz(mode, filter)` | `(mode, filter) => Promise<QuizQuestion[]>` | Samples questions from matching library cards using quiz engine rules. |
| `submitQuiz(id, success, linkSrs)` | `(id, success, linkSrs) => Promise<void>` | Records quiz history; optionally scores SRS rating. |

### 3.4 Associations & Connections
| Method | Signature | Web Behavior |
| :--- | :--- | :--- |
| `addAssociation(sourceId, targetId, note)` | `(s, t, n) => Promise<Association>` | Persists bidirectional word association. |
| `removeAssociation(sourceId, targetId)` | `(s, t) => Promise<void>` | Deletes association. |
| `getAssociations(wordId)` | `(wordId) => Promise<Association[]>` | Returns associations for a word. |
| `getConnectionsNeighborhood(wordId, limit)` | `(wordId, limit) => Promise<Neighborhood>` | Generates graph nodes and edges for the Connections view. |

---

## 4. In-App Peer Feedback System

To maximize review engagement without requiring third-party accounts, Wordloom will feature a lightweight, embedded peer feedback drawer:

### 4.1 Feedback Data Contract
```typescript
interface PeerFeedbackSubmission {
  id: string;                      // Unique UUID
  submittedAt: string;             // ISO 8601 UTC timestamp
  category: 'impression' | 'bug' | 'design' | 'feature';
  rating: number;                  // 1 to 5 stars
  roleOrContext?: string;          // Optional: e.g. "Writer", "ESL Reader", "Developer"
  comments: string;                // Freeform text (max 2000 chars)
  technicalContext: {
    userAgent: string;
    screenDimensions: string;
    activeTheme: string;
    totalWordsCount: number;
  };
}
```

### 4.2 Feedback Transport & Fallback Mechanism
1. **Primary Transport (Cloudflare Worker Webhook):** The client sends a `POST` request to `https://wordloom.pages.dev/api/feedback`. The Cloudflare Worker stores the record in Cloudflare D1 (or forwards to a secure webhook).
2. **Offline / Fallback Transport:** If the network request fails, the submission is saved to `localStorage` under `wordloom_feedback_drafts` and offers the reviewer a one-click *"Copy feedback to clipboard"* or mailto link.

---

## 5. UI & Design System Extensions (`DESIGN.md`)

The web deployment adheres strictly to **Modern Literary Minimalism**:

### 5.1 Welcome & Web Preview Banner
When running in web mode, a quiet, non-intrusive banner appears above the main Library header:
- **Badge:** `Editorial Web Preview`
- **Copy:** *"Welcome to Wordloom. You are exploring a live sample library. All edits persist in your browser."*
- **Action Buttons:**
  1. `[ Leave Feedback ]` (triggers Feedback Modal)
  2. `[ Install Extension ]` (opens Extension Download & Setup Guide)
  3. `[ Reset to Sample Library ]` (restores pristine showcase cards)
  4. `[ Download Desktop App ]` (links to latest GitHub Releases)

### 5.2 Feedback Modal Component
- Clean modal dialogue styled with editorial typography (`Newsreader` serif title, `Inter` field labels).
- Accessible rating selector with keyboard navigation (`1` through `5` keys).
- Category toggle pills: `✨ General Impression`, `🐞 Bug Report`, `🎨 Design & Typography`, `💡 Feature Idea`.
- Clean confirmation state: *"Thank you for shaping Wordloom. Your thoughts have been recorded."*

---

## 6. Cloudflare Pages Deployment Configuration

### 6.1 Build Specification
- **Build command:** `npm run build`
- **Output directory:** `.` (repository root containing `index.html`)
- **Compatibility flags:** `nodejs_compat`

### 6.2 Content Security Policy (`_headers`)
```http
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; media-src 'self' blob: data: https: http:; img-src 'self' data: https:; script-src 'self'; connect-src 'self' https://api.dictionaryapi.dev https://en.wiktionary.org https://wordloom.pages.dev;
```

---

## 7. Gherkin Acceptance Criteria

```gherkin
Feature: Web Platform and Peer Feedback Companion (FEAT-007)

  Background:
    Given the user navigates to "https://wordloom.pages.dev" in a modern browser
    And window.vocabAPI is initially undefined (no Electron runtime)

  Scenario: Web adapter initializes showcase library on first visit
    When the page completes loading
    Then window.vocabAPI should be defined with all 28 methods
    And the Library view should render with 5 showcase starter words
    And the Web Preview banner should be visible
    And no console errors or exceptions should be thrown

  Scenario: Reviewer records and enriches a new word in browser
    Given the user clicks "Add Word"
    When the user enters "mellifluous" and clicks "Save Word"
    Then the client adapter queries the dictionary API
    And the word is added to local storage
    And the word appears in the Library list
    And refreshing the browser page preserves "mellifluous" in the library

  Scenario: Reviewer conducts Leitner spaced repetition review on the web
    Given cards are due in the review queue
    When the user navigates to the "Review Deck"
    And reveals the card back and rates it "Good"
    Then the card's review count increases
    And the interval schedules according to Leitner rules
    And the stats counters on the sidebar update immediately

  Scenario: Reviewer submits peer feedback
    Given the user clicks the "Leave Feedback" button
    When the user selects category "Design & Typography"
    And gives a rating of 5 stars
    And enters "The Newsreader serif headings and paper theme look magnificent."
    And clicks "Send Feedback"
    Then the feedback modal displays a thank-you confirmation
    And the payload is recorded durably with timestamp and metadata

  Scenario: Reviewer accesses the Browser Extension installation guide
    Given the user clicks "Install Extension"
    Then a modal opens with clear step-by-step instructions
    And includes a 1-click button to download "wordloom-extension.zip"
    And provides instructions for loading unpacked in Chrome/Brave/Edge
```

---

## 8. Triad Engineering Protocol Handoff

| Stage | Responsible Agent | Status | Next Milestone |
| :--- | :--- | :--- | :--- |
| **Stage 1: Spec & Architecture** | **Gemini** | ✅ `ready_for_backend` | Spec authored in `docs/spec/FEAT-007_web_platform_and_landing_spec.md`. |
| **Stage 2: Web Adapter & Storage Engine** | **Codex** | ⏳ Pending Stage 2 | Implement `src/services/webAdapter.js`, client dictionary/audio lookups, and test suite in `src/test/webAdapter.test.js`. Gate: `npm test` passes all tests. |
| **Stage 3: Frontend UI, Feedback & Landing** | **Gemini** | ⏳ Pending Stage 3 | Mount `webAdapter.js` in `index.html`, build Feedback Modal, Web Preview Banner, and Extension Guide modal. Test responsive layouts and 0-CLS. |
| **Stage 4: Review, Security & Verification** | **Codex** | ⏳ Pending Stage 4 | Audit CSP headers, verify input sanitization, execute full test suite + E2E verification, and approve `ready_to_ship`. |

---

### Handoff Prompt for Codex (Stage 2 Backend)

```text
@Codex Stage 2 Backend Implementation for FEAT-007 (Web Platform & Cloudflare Deployment):

Please implement the client-side Web Adapter according to docs/spec/FEAT-007_web_platform_and_landing_spec.md:
1. Create `src/services/webAdapter.js` providing a full browser-compatible implementation of all 28 methods on `window.vocabAPI` when running outside Electron (`if (typeof window !== 'undefined' && !window.vocabAPI)`).
2. Use localStorage/IndexedDB for local-first persistence, pre-seeded with starter showcase words if empty.
3. Implement direct client-side HTTPS lookups for Dictionary and Wiktionary APIs matching the existing linguistic normalization and lemmatization logic.
4. Support audio playback via standard HTML5 Audio.
5. Create comprehensive unit tests in `src/test/webAdapter.test.js` verifying that all 28 methods succeed under a browser mock environment and persist mutations across reloads.
6. Verify gate: `npm test`, `npm run lint`, and `npm run build` must pass with 0 errors. Update status in docs/spec/FEAT-007_web_platform_and_landing_spec.md to `backend_complete`.
```
