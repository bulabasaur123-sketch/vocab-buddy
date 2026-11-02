# FEAT-003 Stage 4 verification

**Repository release gate: PASS.** Reviewed immutable application range
`bc0d537..90bb5a1` on November 2, 2026. No release-blocking security or correctness
findings were confirmed. No production code changes were needed during review.
The same formal Codex Security scan was subsequently completed and sealed after
the output-directory permission fix; see its completion record below.

## Verification results

| Check | Result |
| --- | --- |
| `npm test` | Pass: all five test files |
| Direct unit execution | 50/50 cases pass: backend 15, dictionary 10, FEAT-002 10, cache security 1, SQLite 14 |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| Individual `node --check` | Pass for main, preload, all src JavaScript and E2E harness |
| `PYTHONPATH=/tmp/vocab-qa-python python3 e2e/verify.py` | 14/14 real Electron cases pass |
| Electron-bundled Node SQLite tests | 14/14 pass |
| Python compilation | Pass |
| `npm audit --json` | Zero known vulnerabilities across 35 dependencies |
| `git diff --check bc0d537..90bb5a1` | Pass |
| Fresh SQLite `PRAGMA quick_check` | `ok`; no foreign-key check errors |
| Storage containment and permissions | Fixed database inside isolated userData; directory 0700; database, WAL and SHM 0600 on Linux |

The supplied build and lint commands are syntax checks, not desktop packaging
or semantic linting. Source files were also checked individually because Node's
check command does not check every filename passed as a positional argument.

## Review coverage

Reviewed all eight changed files: `docs/spec/FEAT-003_sqlite_persistence_spec.md`,
`e2e/verify.py`, `src/db/sqliteSchema.js`, `src/services/README.md`,
`src/services/storage.js`, `src/store/libraryStore.js`,
`src/test/backend.test.js`, and `src/test/sqliteStorage.test.js`.
Supporting boundaries inspected: main/preload, IPC handlers, WordModel validation,
the renderer E2E consumers and test harness. Review was sequential.

- **SQL injection:** Model values, identifiers used as row keys, timestamps and
  JSON text are bound parameters. SQL identifier interpolation uses fixed internal
  column maps; schema version interpolation uses a module constant. Injection-like
  IDs/citations persist as literal data and do not change the table or other rows.
  No SQL text or database handle is exposed through preload.
- **Path containment:** Main constructs storage from `app.getPath('userData')`.
  Storage derives fixed `vocab_buddy.db` and `vocab_library.json` filenames.
  Renderer input supplies vocabulary models and IDs, not database destinations.
  User-controlled text is never incorporated into database filenames. userData and
  application files are assumed to be controlled by the signed-in OS user.
- **IPC:** All named handlers check the sender frame; context isolation and the
  restricted bridge remain intact. Renderer Node access is disabled. Existing
  tests exercise untrusted-frame rejection and named bridge exposure.
- **Atomicity and recoverability:** Initialization, version-one schema upgrade,
  imports and review read/update use explicit transactions. Trigger-based tests
  prove a review updates one matching row without deleting/reinserting the table.
  Failed replacements and reviews roll back. Schema upgrades retain pending
  migration markers. JSON is archived only after commit; pending markers recover
  post-commit rename failures without reimporting. Existing backups are preserved.
  Malformed legacy files and corrupt/future databases fail without replacement.
- **Model fidelity and queues:** Nested JSON, audio metadata and original timestamp
  text survive persistence. Missing legacy labels/intervals receive documented
  defaults. Epoch indexing correctly orders offset timestamps. Query-plan tests
  confirm due-index use; queue/statistics reads avoid full-library deserialization.
  Multiple stores read committed state rather than overwriting stale snapshots.
- **Integration:** Real Electron verifies SQLite disk state through the IPC bridge,
  word add/duplicate/delete, import setup and export, root resolution/search,
  review grading/race protection, empty queues, cached audio/CSP, dialog focus,
  markup escaping, theme/filter controls and narrow viewport overflow.

## Verification limits

External dictionary/audio HTTP uses fixtures. Concurrent playback uses an
instrumented Audio consumer; the CSP audio test uses Chromium's real Audio.
Functional mouse actions use DOM events to avoid headless compositor stalls,
and native deletion confirmation is accepted by a test fixture. Physical mouse,
native dialogs, speakers, packaged installation, power-loss durability and
zero-CLS behavior are not established by this run. WAL with synchronous NORMAL
is the specified policy; power-loss behavior was not fault-injected. The existing
`--no-sandbox` launch configuration remains a deployment limitation.

## Formal security scan completion

Scan `57a167b0-5591-4e41-95db-c46166ea2bb0` was resumed and sealed successfully
at `2026-11-02T14:13:10.285514Z` after the user changed `~/.codex` to mode 700.
The original immutable `bc0d537..90bb5a1` target was retained; no replacement
scan was created. Canonical coverage is complete with no deferred work and
zero reportable findings. The host generated the sealed manifest, findings,
coverage, Markdown report and SARIF export, and completed readback was verified.
The scope and runtime limitations described above still apply.

Artifacts are in the plugin's existing scan directory:
`~/.codex/state/plugins/codex-security/scans/Vocab-Buddy/90bb5a1b902bbba17c4bda74ea7360e5f61f6e70_20261102T135724Z_8xphkzpo/`.
The primary report is `report.md`; machine-readable output is
`exports/results.sarif`. Plugin-reported rollout usage at finalization was
3,661,417 tokens, including 3,614,720 cached input tokens (one thread).
No application code changed and the prior test results were not rerun solely
for this permission and artifact-finalization continuation.

## Reproduce

```sh
npm test
npm run lint
npm run build
npm audit --json
PYTHONPATH=/tmp/vocab-qa-python python3 e2e/verify.py
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron src/test/sqliteStorage.test.js
```

Install the pinned `e2e/requirements.txt` into an isolated Python environment
first. Electron execution requires permission to open its localhost debugging
socket; all application data for E2E runs is temporary and isolated.
