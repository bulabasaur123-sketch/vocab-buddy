# DESIGN.md — Vocab Buddy Design Specification

> **Aesthetic Direction:** *The Modern Editorial Lexicon*  
> **Anti-Slop Posture:** Zero AI tropes. No neon purple/cyan gradients, no floating glassmorphism, no meaningless emojis/sparkles, no buzzwords. Crafted specifically for readers and book lovers.

---

## 1. Personality & Identity

* **Archetype:** Archival Literary Companion. A digital bridge between a fine physical volume (clothbound book, card catalog slip, unbleached paper) and a sharp, distraction-free desktop utility.
* **Mood:** Quiet, focused, intellectually dignified, tactile, and restrained.
* **Tone:** Modest and direct. Speaks like a reference librarian or an editor, never like a hyperactive software marketer.

---

## 2. Palette: Ink & Paper

We reject generic dark-mode purples (`#8a2be2`, `#6366f1`) and electric neon orbs. The color system uses real-world material analogs: carbon ink, unbleached archival paper, and heritage bookcloth accents.

### Light Scheme (*Archival Paper*)
* **Canvas / Ground:** `#F7F5F0` (warm unbleached vellum paper)
* **Surface / Cards:** `#FFFFFF` (crisp matte white card)
* **Dividers & Hairlines:** `#E5E0D5` (subtle pencil stone)
* **Primary Text (Carbon Ink):** `#1A1A1A`
* **Secondary Text (Graphite):** `#5A5A58`
* **Muted Text / Annotations:** `#8A8A85`
* **Heritage Accent (Bookcloth Burgundy):** `#852B3B` (or deep forest green `#1E4835`)

### Dark Scheme (*Midnight Reading Room*)
* **Canvas / Ground:** `#141517` (deep matte carbon slate)
* **Surface / Cards:** `#1B1D20` (elevated matte surface)
* **Dividers & Hairlines:** `#282A2E` (subtle lead wire)
* **Primary Text (Parchment):** `#EDEAE2`
* **Secondary Text (Warm Gray):** `#9C9990`
* **Muted Text / Annotations:** `#6C6A63`
* **Heritage Accent (Aged Amber / Crimson):** `#C87D32` (or muted rosewood `#9E3D4C`)

---

## 3. Typography: Editorial Dignity

No generic browser defaults. We employ a triple-font hierarchy rooted in print lexicography:

1. **Serif (The Word & Etymology):** `Newsreader` or `EB Garamond`
   * Used for the main vocabulary words, linguistic roots, and book quotation excerpts.
   * Gives historical gravity and editorial beauty to language.
2. **Grotesque Sans (Interface & Navigation):** `Inter` or `Geist`
   * Used for buttons, search inputs, tabs, and status badges.
   * Neutral, legible, unobtrusive.
3. **Monospace (Phonetics & Metadata):** `JetBrains Mono` or `IBM Plex Mono`
   * Used for phonetic brackets (e.g. `[ˌsɛr.ənˈdɪp.ɪ.ti]`), timestamps, and review intervals.

---

## 4. Anti-Slop Audit: What We Explicitly Cut

| AI Slop Trope (The "Tells") | What Vocab Buddy Uses Instead |
| :--- | :--- |
| **Neon blue-to-purple gradients & glowing borders** | Solid, matte surfaces with crisp 1px borders inspired by printed rule lines. |
| **Glassmorphism on every card and navbar** | Solid paper/carbon cards with single-plane elevation. |
| **Pill shapes everywhere (radius: 9999px)** | Disciplined 4px–8px radius (mimicking cut index cards and book covers). |
| **Sparkles & Hype copy ("✨ Auto-Enrich", "Supercharge")** | Plain, quiet verbs: *"Record word"*, *"Lookup origin"*, *"Review deck"*. |
| **Cookie-cutter 3-box metric dashboards** | Integrated reader colophon (`38 words recorded · 4 due today`). |
| **Soft blurry shadows everywhere** | Flat surfaces with subtle, crisp offset shadow (`0 2px 4px rgba(0,0,0,0.06)`). |
| **Rainbow-colored flashcard rating buttons** | Understated typographic buttons with subtle border hover states and clear keyboard cues (`[1] Again`, `[2] Hard`, `[3] Good`, `[4] Easy`). |

---

## 5. Key UI Component Wireframes (Stage 3 Blueprint)

### 5.1 The Reader's Entry Bar (Top)
```
┌────────────────────────────────────────────────────────────────────────┐
│  Word: [ serendipity                        ]  Source: [ Dune, p. 42 ] │  [ Record Word ]
└────────────────────────────────────────────────────────────────────────┘
```
* Single-line, distraction-free. No giant gradient orbs.
* Clean label and placeholder. Submitting triggers an understated subtle underline loader, not a carnival spinner.

### 5.2 The Lexicon Card (Library View)
```
┌────────────────────────────────────────────────────────────────────────┐
│  Serendipity                                          [noun]  [Box 2]  │
│  [ˌsɛr.ənˈdɪp.ɪ.ti]   (▶)                                              │
│                                                                        │
│  1. An unsought, unintended, and fortunate discovery made by accident. │
│     "A stroke of serendipity revealed the missing manuscript."         │
│                                                                        │
│  — Origin: From Serendip (Sri Lanka) + -ity. Coined by Horace Walpole   │
│    in 1754 based on 'The Three Princes of Serendip'.                   │
│                                                                        │
│  From: The Persian Letters                                   3 days    │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 The Review Deck (Flashcard Mode)
* Styled after physical 3x5 index cards.
* Clean matte background with crisp text and authentic paper texture.
* Front: Word in large editorial serif, phonetic transcription, audio speaker, book tag.
* Back: Cleanly structured definitions, historical etymology tree, and example quotes.
* Controls: Minimal, quiet buttons with keyboard triggers `[1]`, `[2]`, `[3]`, `[4]`.

---

## 6. Liveliness Dials (Antislop Part 3)
* **ENERGY:** `2/5` — Deliberate and serene. Reading software should calm the eyes, not stimulate dopamine.
* **RHYTHM:** `3/5` — Elegant typographic contrast between large serif titles and compact sans annotations.
* **MOTION:** `1/5` — Instantaneous or subtle 150ms transitions. No gratuitous spring bounciness.
