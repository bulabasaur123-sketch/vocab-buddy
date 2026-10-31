# FEAT-001 backend integration

Run `npm ci` and `npm test` with Node 22 or later. `npm start` launches Electron
with the Linux `--no-sandbox` flag required by the specification. Until Stage 3
provides `index.html`, the window displays a backend-ready placeholder.

The context-isolated `window.vocabAPI` exposes Promise-returning methods:

- `lookupWord(word, bookSource = '')`: enrich a word without saving it.
- `addWord(word)`: save a validated lookup result; reject duplicate words.
- `loadWords()`: return a detached library snapshot.
- `saveWords(words)`: validate and replace the library; resolve to `true`.
- `removeWord(id)`: remove an entry and return the updated library.
- `reviewWord(id, rating)`: persist a review and return the updated library.
- `getReviewStats()` and `getDueWordsQueue()`: read current review state.
- `exportData()`: return a WordModel array for frontend backup serialization.
- `importData(words)`: validate and replace the library; resolve to `true`.

Catch rejected calls to display errors. Dictionary errors distinguish spelling,
rate limiting, HTTP, and network failures. Wiktionary failure is nonfatal when
the dictionary succeeds; unavailable enrichment fields are empty strings.
Render external definitions and etymology as text, rather than HTML.

Storage writes a versioned payload to Electron's `userData/vocab_library.json`
using a flushed temporary file and atomic rename. Invalid existing payloads are
preserved beside the library as `.corrupt-<uuid>` before recovery. Filesystem
errors propagate rather than silently discarding the library. Empty libraries
remain empty on restart. Imports replace, rather than merge, the library.

Review days are elapsed 24-hour periods. New cards are immediately due with a
one-day base interval. Good/easy intervals are rounded after multiplication;
thus the first good rating schedules three days. Hard keeps the current box
and clamps the current interval to one or two days. Box five remains reviewable.
The optional `intervalDays` field is written on every review.

Tests live in `src/test/`, following Codex's ownership boundary, and use the
Node built-in runner. Network requests are injected fixtures; tests do not
verify availability of live providers or playback of remote audio. Electron
lifecycle and bridge behavior are tested with module doubles; desktop visual
and browser interaction checks belong to the later integration stages.
