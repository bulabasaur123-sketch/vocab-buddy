# Desktop redesign — approved steps 1–4

User-approved scope: application shell and tokens; scalable Lexicon and capture;
focused learning; shelves and settings. No backend, schema or Leitner changes.
The explicit user instruction authorizes frontend changes for this task.

## Decisions

- Compact sidebar with a labeled menu below 850px; reading content stays constrained.
- Default list plus optional grid; search/filter then deterministic sorting then
  50-word pagination. Bound rendered DOM rather than adding virtualization now.
- Favorites independent of review status; tag search inside progressive disclosure.
- Add Word uses a dialog; successful lookup retains the existing immediate save.
- Word detail docks at wide widths and overlays at narrow widths. Definitions
  precede etymology; preserve pronunciation, inflected form, citation and organization.
- Explicit review reveal, then grading; preserve scheduling and submission guards.
- Separate quiz setup/session/results; in-memory incorrect answers and truthful
  schedule-save feedback. No persistent quiz history is implied.
- Settings consolidates theme, reading size, export and learning/keyboard help.
- Keep existing backend services/preload unchanged. Desktop helpers sit in
  src/ui/desktop.js; desktop.css layers shared desktop tokens over established styles.

## Acceptance

Keyboard-operable navigation, browsing, dialogs and study; visible focus in both
themes; long text reflows; default list/pagination handle 1,000+ words; no learning
or persistence regressions. Test wide, laptop and narrow windows, including large
reading size. Preserve the existing 57 unit and 18 functional E2E scenarios,
adapting test navigation to intentionally changed UI flows and adding regressions.

Deferred cross-platform work: ../roadmap/cross-platform-next.md.

## Completion

Desktop steps 1–4 are implemented. Verification: 57 unit cases, 23 isolated
Electron E2E scenarios, lint/build and all 21 individual JavaScript syntax checks
pass. The library regression uses 1,000 entries and bounds rendered rows to 50.
See ../../e2e/desktop-redesign-verification.md for scope, visual checks and limits.
Steps 5–8 remain deferred in the roadmap; they are not implemented or authorized.
