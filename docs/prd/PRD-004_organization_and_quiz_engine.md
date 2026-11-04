---
title: "PRD-004: Word Organization (Collections, Tags, Favorites) and Retention Quiz Engine"
type: prd
feature_code: FEAT-004
status: draft
active_owner: gemini
created_at: 2026-11-04
updated_at: 2026-11-04
---

# PRD-004: Organization Suite & Active Retention Quiz Engine

> **Feature Code:** FEAT-004  
> **Type:** Product Requirements Document & Feature Concept  
> **Status:** Draft / Architectural Proposal  
> **Lead Architect:** Gemini  
> **Target Execution:** Stage 1 Spec -> Stage 2 Codex -> Stage 3 Gemini UI  

---

## 1. Vision & Problem Statement

* **Core Purpose:** Transform Vocab Buddy from a passive lookup vault into an **active retention companion** for book readers, writers, and language enthusiasts.
* **The Problem:** 
  1. As readers log dozens or hundreds of words, a flat chronological list becomes overwhelming without categorization by domain (e.g., *everyday speech*, *creative writing*, *scientific/academic*).
  2. Passive flashcard review (self-rating "did I know this?") is prone to recognition bias. Active recall through interactive quizzes forces neurological retrieval and drastically improves long-term vocabulary retention.

---

## 2. Proposed Feature Modules

### Module A: Organization & Curation

1. **Favorites (⭐ 1-Click Bookmark):**
   - Quick toggle star icon on every word card and search result.
   - Dedicated "Favorites" filter/view in the sidebar navigation.
   - Backend: Indexed boolean column `is_favorite` in SQLite schema.

2. **Collections ("Folders" / Lists):**
   - User-defined named collections (e.g., *"Daily Speech"*, *"Gothic Literature"*, *"Formal / Academic"*).
   - **Architectural Decision:** Implement as flexible collections (many-to-many relationship) rather than rigid mutually exclusive folders. A word like *obsequious* can simultaneously belong to *"Literature"* and *"Work Email Vocabulary"*.

3. **Tags (`#label`):**
   - Granular keywords attached to words (e.g., `#verb`, `#french-root`, `#tone-dark`).
   - Quick chip filter bar in the library view to intersect tags and collections.

---

### Module B: Active Retention Quiz Engine

Interactive, gamified micro-quizzes operating on words logged in the user's SQLite vault:

1. **Quiz Mode 1: Definition Match (Multiple Choice 4-Option):**
   - Prompt: Displays target word.
   - Choices: 4 definitions (1 correct definition, 3 distractor definitions sampled from other library words).
   - Fast, low-friction, high engagement.

2. **Quiz Mode 2: Sentence Cloze (Fill in the Blank):**
   - Prompt: Takes an existing example sentence fetched from Wiktionary/FreeDictionary and replaces the target word with `______`.
   - The user identifies the word or selects from options.

3. **Quiz Mode 3: Morphological Spelling / Missing Letters:**
   - Prompt: Shows the definition and phonetic transcription with missing letters (e.g., `e _ u i v _ c a t e`).
   - Forces active spelling and root recognition.

4. **Integration with Leitner SRS:**
   - Option for quiz results to influence Leitner box levels (correct answers advance box, wrong answers flag for review).

---

## 3. Next Steps
- Review with Human User.
- Transition into formal Technical Specification (`docs/spec/FEAT-004_spec.md`) once scope is approved.

