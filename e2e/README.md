# FEAT-001 Stage 4 verification

Result: **release gate failed**. The specification remains `frontend_integrated`;
`ready_to_ship` was not set. Reviewed application revision: `fbeb729` (2026-10-31).
Production files were not modified during this verification.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | Pass; both Node test files pass |
| Individual Node test execution | 25 tests pass (15 backend + 10 dictionary) |
| `npm run build` | Fail: script is absent |
| `npm run lint` | Fail: script is absent |
| `node --check` on main, preload, renderer, E2E harness | Pass |
| `npm audit --json` | Zero known dependency vulnerabilities at verification time |
| Real headless Electron E2E | 9 tests: 3 pass, 5 assertion failures, 1 timeout error |
| Whitespace check over feature diff | Trailing whitespace in HTML, CSS and spec metadata |

The passing Electron tests cover the real context bridge, IPC, JSON disk
round-trip, rendered markup escaping, search/filter controls, theme switching,
and exported JSON download. The lookup test reaches successful enrichment,
addition, duplicate detection and missing-word feedback, then times out on the
headless delete-button actionability check; deletion through the UI is not
claimed verified. Store-level deletion passes the unit suite.

## Required frontend repairs

1. **P1: Review Deck is invisible.** `index.html:126` initializes the review
   section with `hidden`. `src/renderer.js:578-592` toggles only `active`.
   `src/styles/main.css:1028-1030` makes `hidden` override display with
   `!important`. Clicking Review Deck leaves `view-panel hidden active` and
   an empty main area. The visibility regression test fails.
2. **P1: Repeated ratings double-grade and skip cards.**
   `src/renderer.js:536-546` captures the current card before awaiting IPC and
   has no in-flight guard. Two rapid `3` key events after revealing a card
   increment its persisted reviewCount twice and advance deckIndex twice,
   skipping the following card. The real-IPC regression records count 2
   where count 1 is expected.
3. **P2: Future cards enter the scheduled queue.**
   `src/renderer.js:439-441` substitutes the first ten library words when the
   backend due queue is empty. With one card due in 2099, opening the deck
   queues that card despite the due count being zero. Treat optional practice
   as a separate explicit action, or preserve the empty scheduled queue.
4. **P2: Editing an input triggers deck shortcuts.**
   `src/renderer.js:552-568` handles Space and rating digits without checking
   the focused input/contenteditable target. In Review Deck mode, typing Space
   in Source Citation flips the card and suppresses the typed space; a digit
   after a reveal can also submit a review.
5. **P2: Narrow layouts overflow.** At a 390px viewport, document scrollWidth
   is 546px in the isolated Electron run. `src/styles/main.css:112-121` keeps
   the masthead in a single flex row, while the media rules at 1032-1044 only
   adapt entry, rating and filter controls. The responsive regression fails.

Frontend repairs belong to Gemini under AGENTS.md. Add genuine project build
and lint commands, then rerun all required checks and these regressions before
advancing the feature status. No frontend workaround was applied to make the
release gate pass.

## Security verification limits

Source review covered all 13 runtime files in the frozen `adb9c7e..fbeb729`
change inventory and supporting tests/configuration. IPC sender rejection,
restricted bridge exposure, schema validation and atomic-write failure recovery
pass the unit checks; markup payloads render as text in real Electron.
The requested `--no-sandbox` startup flag disables Chromium's OS sandbox even
though context isolation and the restricted preload bridge remain configured.
Live provider uptime, remote MP3 playback and packaged desktop distribution
were not exercised; outbound dictionary responses are fixtures.

The formal security plugin scan is **not finalized**. Its canonical draft
writer rejects the group-writable `/home/zeto/.codex` ancestor (mode 775) with:
`Scan output parent must not be group- or world-writable without the sticky bit.`
No global permissions were changed and no sealed security report is claimed.
The existing scan `ff350e97-7fd0-4272-b300-ac51b456649c` retains the review context
and empty candidate inventory for supported recovery; do not replace that scan.

## Reproduce

Install project dependencies with `npm ci`. Install `requirements.txt` into an
isolated Python environment, for example:

```sh
python3 -m venv /tmp/vocab-e2e-venv
/tmp/vocab-e2e-venv/bin/pip install -r e2e/requirements.txt
/tmp/vocab-e2e-venv/bin/python -m unittest discover -s e2e -p verify.py -v
```

Linux must allow a localhost debugging connection and execution of Electron's
bundled Chromium with the headless Ozone backend. No separate browser download
is required. The harness points userData at a fresh temporary directory, replaces
only dictionary HTTP responses, and uses the actual application main/preload,
services, store and renderer. Test data and processes are cleaned up afterwards.
External renderer HTTPS requests are blocked after connection. Background frame
throttling is disabled only in the harness. Some functional form/export checks
use DOM events to avoid headless compositor actionability timeouts; these do not
establish full physical mouse or accessibility coverage. Review visibility is
asserted without removing `hidden` or modifying application CSS.
