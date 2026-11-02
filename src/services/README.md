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
one-day base interval. The destination box determines the interval and label:
Daily (1), 3 Days (3), Weekly (7), Fortnightly (14), Mastered (30).
Again resets to box one, hard retains the box, good advances one box, and easy
advances two, capped at five. Existing libraries receive missing box labels on
load without moving scheduled dates.

## FEAT-002 integration

Lookups resolve English Wiktionary form links, dictionary source headwords, and
validated suffix guesses (bounded to five unique headwords). Canonical results
retain the original query as `inflectedForm`. Suffix guessing is a conservative
fallback for entries lacking pronunciation; it is not a general English parser.

Electron initializes `AudioStorageService` in `userData/audio`. Downloads accept
HTTPS dictionaryapi.dev and Wikimedia provider hosts, reject redirects, enforce
102400 bytes while streaming, and atomically publish successful files. Failed
or oversized recordings leave lookup results usable without cache metadata.
Existing cache files are reused offline. The `.mp3` cache filename follows the
spec; Ogg/WAV bytes are preserved without transcoding.

Use `await window.vocabAPI.getAudioDataUrl(word.word)` to obtain a cached data URL
or null. This trusted-frame IPC method accepts a headword, never a filesystem
path, and reports the recording MIME type. `audioLocalPath` is relative to the
audio directory; `audioSizeBytes` records the cached size. UI playback integration
remains Stage 3 work.

Tests live in `src/test/`, following Codex's ownership boundary, and use the
Node built-in runner. Network requests are injected fixtures; tests do not
verify availability of live providers or playback of remote audio. Electron
lifecycle and bridge behavior are tested with module doubles; desktop visual
and browser interaction checks belong to the later integration stages.
