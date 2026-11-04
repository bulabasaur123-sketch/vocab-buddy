# Cross-platform roadmap — deferred steps 5–8

Recorded following approval of desktop redesign steps 1–4. These are planning
notes, not authorization to introduce frameworks, schema changes or cloud services.

## Step 5 — Shared core and adapter boundaries

Extract pure vocabulary validation, normalization, Leitner scheduling, quiz
construction and scoring behind platform-neutral application operations. Preserve
existing learning behavior through contract tests. Inject clocks and randomness.
Keep DOM, Electron IPC, Node filesystem/crypto and SQLite access in adapters.
Keep desktop on Electron and vanilla JavaScript unless a separate evaluation
justifies migration. Share tokens and interaction meanings, not whole layouts.

## Step 6 — Browser-extension capture prototype

Primary flow: select a word → user-invoked capture → definition → editable source
and excerpt → save → return to reading. Include graceful duplicate handling.
Use a compact popup; a longer capture may need a side panel. Persist interrupted
capture drafts. Prefer activeTab and narrowly scoped provider permissions; avoid
always-on selection tracking, broad page access and intrusive modifications.
Handle restricted pages through manual entry. Render page content as plain text;
do not send captured excerpts to dictionary providers. Preview/removal of source
URL and context must be available before saving.

Resolve the destination before launch: extension storage cannot directly read
Electron's SQLite library. Options are versioned file transfer, an approved native
messaging bridge, or separately approved synchronization. Until connected, label
saves as local to the extension, not saved to the desktop Lexicon.

## Step 7 — Mobile study prototype

Evaluate a Capacitor prototype against a native-rendered alternative before
choosing a mobile framework. Include Android and prospective iOS costs, native
storage/plugin support, keyboard handling, share capture and accessibility.
Mobile navigation: Study, Lexicon, Capture, Settings; shelves inside Lexicon.
Design short review/quiz sessions, large touch controls, system text scaling,
TalkBack/VoiceOver support, offline saved vocabulary and cached pronunciation.
No swipe-only actions. New offline capture awaiting lookup needs an approved
model/workflow; existing validation requires enriched records.

## Step 8 — Optional history, migration, authentication and synchronization

Remain local-first and account-free until approved. Define structured multiple
source encounters (URL, title, excerpt, capture time), preserving legacy citation
strings. Full review history is not currently persisted: specify append-only
review events, stable IDs and deterministic conflict handling before multi-device
study. Do not silently resolve simultaneous reviews by last-write-wins.

Specify a complete versioned backup format including shelves/memberships, media
references and history. Current word-array exports require existing shelf IDs.
Migrations must back up data, validate, run transactionally and preserve records.
Sync needs durable retries/outbox, operation deduplication, deletion tombstones,
account isolation, credential storage, recovery/deletion, cost and privacy decisions.
Use truthful saved-local/pending/synced/error states. Browser storage.sync is not
a cross-platform synchronization backend. Defer cloud vendor and auth selection.

## Decisions retained

Desktop is for management and extended study; extension for capture; mobile for
short sessions. Share Modern Literary Minimalism: ivory/neutral surfaces, burgundy,
serif vocabulary, readable sans-serif controls and accessible state conventions.
Do not promise cross-device availability before a transport exists. Reassess
provider availability/licensing, language coverage, browser compatibility, offline
media limits, native build tooling and recurring infrastructure costs before launch.
