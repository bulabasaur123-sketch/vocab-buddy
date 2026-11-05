---
title: "ADR-005: Bounded Neighborhood Graph Visualization and Immersive Full-Screen Map Mode"
type: adr
status: accepted
created: 2026-11-05
updated: 2026-11-06
tags:
  - vocab-buddy
  - adr
  - architecture
  - graph-visualization
  - antislop
---

# Architecture Decision Record (ADR): Bounded Neighborhood Graph Visualization and Immersive Full-Screen Map Mode

**Status:** Accepted  
**Date:** 2026-11-06  
**Deciders:** Human Lead Engineer, Gemini Architect, Codex Auditor  
**Feature Code:** `FEAT-005-CONNECTIONS-AND-ASSOCIATIONS`  

---

## 1. Context & Problem Statement

Vocab Buddy’s primary promise is **“Your reading, remembered.”** As readers save vocabulary across novels, philosophical essays, and classic literature, entries develop organic semantic and contextual relationships:
- Shared literary provenance (e.g. *Meditations* by Marcus Aurelius, *The Picture of Dorian Gray* by Oscar Wilde).
- Common thematic tags (e.g. `#philosophy`, `#stoic`, `#sensory`).
- Curated reading shelves (e.g. *Victorian Literature*, *Stoic Philosophy*).
- Reader-authored cognitive associations (e.g. *Ephemeral* $\longleftrightarrow$ *Dalliance* on shared brevity).

Previously, vocabulary could only be browsed via flat alphabetical lists or grid cards. We needed an exploratory graphical visualization ("neural graph" / Obsidian-like mind map) that reveals how words interconnect.

However, naive implementations of graph views frequently devolve into **"AI slop"**:
- An unconstrained global canvas attempting to simulate thousands of nodes simultaneously, resulting in a chaotic "cosmic spiderweb" that conveys zero actionable insight.
- Perpetual, battery-draining physics loops running `requestAnimationFrame` continuously in the background.
- Cluttered, claustrophobic canvas boxes trapped inside narrow desktop application frames.

---

## 2. Decision Drivers

- **Cognitive Clarity:** The reader should easily see the immediate context of a word without information overload.
- **Performance & Battery Preservation:** Zero perpetual physics loops; simulation must settle and completely freeze when stable.
- **Immersive Spatial Experience:** Allow readers to expand the graph into a dedicated, distraction-free full-screen environment.
- **Relational Integrity:** Reader-authored mutual associations must be stored canonically without edge duplication or self-links.
- **Accessibility & Zero-CLS:** Keyboard navigable, screen-reader friendly companion list view, and zero layout shift.

---

## 3. Considered Options

- **Option A: Global Force-Directed Graph (All Words)**
  - *Description:* Render every word in the lexicon on a single unbounded canvas with dynamic links.
  - *Tradeoffs:* Extreme visual clutter beyond 50 words; $O(N^2)$ Coulomb force computations causing high CPU usage; low semantic value.
- **Option B: External Visualization Library (D3, Cytoscape, Vis.js)**
  - *Description:* Bundle an external NPM graph package.
  - *Tradeoffs:* Adds 100KB–500KB of external dependencies, native compilation risks, and style mismatches with our custom archival paper/ink design tokens.
- **Option C: Custom Bounded Neighborhood Graph with Immersive Fullscreen (Chosen)**
  - *Description:* Pure HTML5 Canvas 2D engine with an ego-centric local graph (center word surrounded by bounded source, tag, shelf hubs, and personal associations), settling energy cutoff, and distraction-free full-screen overlay.

---

## 4. Decision Outcome

We adopted **Option C**.

### Architectural Pillars:

1. **Ego-Centric Bounded Neighborhood Model:**
   - Rather than rendering an unmanageable global web, the map centers on one selected word ($W_0$).
   - Hub nodes aggregate reading provenance (Source Hub $\le 1$), thematic tags (Tag Hubs), and curated collections (Shelf Hubs), with bounded sample previews ($\le 10$).
   - Reader-created mutual associations connect directly as distinct word nodes.

2. **Thermodynamic Force Simulation with Zero Background CPU:**
   - Simulated with damped Hooke springs, Coulomb repulsion, and centering gravity.
   - Halts unconditionally when total kinetic energy falls below $\epsilon = 0.005$ or after 180 simulation steps ($\sim 3$ seconds).
   - Once settled, `cancelAnimationFrame` freezes the loop, eliminating background battery drain.

3. **Immersive Full-Screen Map Architecture (`body.map-fullscreen`):**
   - The map view can expand into full screen via the toolbar button (`#map-btn-fullscreen`) or <kbd>F11</kbd>.
   - Combines standard HTML5 Fullscreen (`document.documentElement.requestFullscreen()`) with declarative CSS isolation.
   - When active, the sidebar navigation, page headings, and colophon footer are hidden.
   - The interactive canvas expands to $100\text{vw} \times 100\text{vh}$, adapting via `ResizeObserver` and HiDPI `devicePixelRatio`.
   - Controls float in an elegant, glass-morphism pill pinned at the top with frosted backdrop blur and surface shadow.
   - Word detail modals float at `z-index: 1100`, allowing readers to edit words without leaving full-screen mode.
   - Switching to List View automatically exits map full screen, ensuring standard text reading layouts remain unconstrained.

4. **Canonical Undirected Edge Storage in SQLite:**
   - Stored in SQLite table `word_associations (word_id_1, word_id_2, note, created_at)`.
   - Enforced by `CHECK (word_id_1 < word_id_2)` and `PRIMARY KEY (word_id_1, word_id_2)`.
   - Eliminates duplicate bidirectional rows and prevents self-associations.
   - Cascades deletions automatically when any associated word is deleted.

---

## 5. Consequences

### Positive
- **Archival Aesthetics & Zero Clutter:** The visualization feels like an elegant editorial mind map, matching Vocab Buddy's serif typography and paper tones.
- **Superior Performance:** Zero ongoing CPU overhead when idling.
- **Zero External Dependencies:** Built entirely with native Web APIs (`<canvas>`, `requestAnimationFrame`, `ResizeObserver`, `requestFullscreen`).
- **Complete Test Coverage:** Fully verified with 70 unit tests and 30 Playwright E2E verification tests.

### Tradeoffs
- Readers cannot view all words simultaneously on one macroscopic screen; they navigate by pivoting through connected nodes.
