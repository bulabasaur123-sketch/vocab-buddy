# Desktop redesign verification — steps 1–4

Scope: approved desktop navigation/tokens, scalable Lexicon and capture, focused
study, shelves and settings. Deferred work is recorded in
[the cross-platform roadmap](../docs/roadmap/cross-platform-next.md).

## Changes and decisions

- Preserved vanilla JavaScript/Electron and the existing preload, services,
  database schema, vocabulary records and Leitner algorithm. No dependencies added.
- Added a responsive sidebar and five destinations. Below 850px a labeled Menu
  reveals navigation; study screens omit the unrelated library footer.
- Default list plus saved grid preference, alphabetical/newest/review sorting,
  independent favorites/status/shelf filters, searchable tags, 50-item pagination.
  Filtering/sorting operate before pagination. Only visible-page rows/audio checks
  are constructed; the initial library still loads through the existing backend.
- Add Word is an explicit dialog. Lookup/save, duplicate detection, source citation,
  inflected forms, pronunciation and validation remain functional.
- Detail docks at wide widths and becomes a focused overlay at narrow widths.
  Native buttons, dialog focus trapping/restoration, inert background surfaces,
  visible focus and keyboard shortcuts replace click-only paths.
- Review reveal gates grading, displays existing schedule intervals, and prevents
  duplicate writes. Quiz setup is separate from questions; results include wrong
  answers, truthful SRS-save counts and practice-only feedback. Repeated answer
  and Next events do not double-grade or skip questions.
- Shelves support search, creation, opening and confirmed deletion without removing
  words. Settings consolidates appearance, reading size, export and cadence help.
- Maintained plain-text rendering and existing CSP. No unsafe-eval was introduced.
  The test harness polls through direct CDP function evaluation to avoid an
  intermittent Playwright string-predicate/CSP failure and headless frame stalls.

## Verification

- `npm test`: six files pass; direct execution confirms 57/57 unit cases.
- `npm run lint` and `npm run build`: pass. These project commands are syntax
  checks, not packaging/semantic linting. All 21 JavaScript files also checked
  individually with `node --check`.
- Real isolated Electron E2E: **23/23 pass in 24.118 seconds**. The 18 existing scenarios are retained with updated
  navigation for Add Word and independent favorites. Five new regressions cover
  1,000-word pagination/search/combined filters, capture keyboard/focus, deliberate
  review reveal, duplicate quiz navigation/incorrect summary, and shelf/settings
  persistence plus lengthy-content layouts at 390/768/1024/1440 pixels.
- All 138 HTML IDs are unique; working diff whitespace check passes.
- Visual inspection in Chromium: Lexicon, detail panel, Add Word, Review Deck
  before/after reveal, quiz setup/question, Shelves and Settings. Light and dark
  themes inspected, including narrow layout. Normal pointer operation of the quiz
  SRS checkbox passes independently of Electron's headless compositor.
- Contrast calculations: muted text 5.21:1 on light canvas and 7.20:1 on dark
  surface; accent text 8.73:1 light and 8.44:1 dark; control boundaries 3.66:1
  light and 3.94:1 dark. Focus uses the corresponding accent with visible offset.

## Remaining limits and deferred improvements

Initial SQLite hydration still reads the full library and its metadata; pagination
bounds DOM work, not database startup cost. Server-side pagination or bulk hydration
requires a separately approved backend change. Tags are searched with up to 50
matching controls shown, avoiding an unbounded filter bar.

Word-array export does not include shelf definitions. This existing limitation is
now explained in Settings; a complete versioned backup/transfer format is deferred.
No schema change, history store, extension, native mobile app, authentication or
synchronization infrastructure was introduced.

Electron tests use temporary userData and HTTP fixtures. Several functional actions
use DOM events because Ozone's hidden compositor can stall pointer actionability;
keyboard focus uses real key events. Visual Chromium checks use in-memory bridge
fixtures, with external fonts/network blocked, so they show fallback fonts. Actual
Electron bridge/persistence behavior is verified separately by the E2E suite.

Large reading size, long text and narrow layouts are covered; this is not a formal
screen-reader audit, complete 200% OS-zoom certification, packaged-installation
verification, live provider/media availability test or power-loss test. Native
confirmation dialogs are accepted by fixtures in deletion tests. External fonts
still fall back offline. The unchanged --no-sandbox launch policy remains outside
this frontend scope.

## Reproduce

```sh
npm test
npm run lint
npm run build
PYTHONPATH=/tmp/vocab-qa-python python3 -m unittest discover -s e2e -p verify.py -v
```

Install the pinned e2e/requirements.txt into the temporary Python path first.
The Electron harness requires permission to open its localhost debugging socket.
