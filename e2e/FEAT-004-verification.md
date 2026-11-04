# FEAT-004 Stage 4 verification

**Current release gate: PASS.** Reverified application revision
`989c001` on November 4, 2026, including repair range `a3c14a8..989c001`.
The original favorites-sampling blocker is resolved. No production code or tests
were changed during this rerun. FEAT-004 qualifies for `ready_to_ship`.

## Final rerun results

| Check | Result |
| --- | --- |
| `npm test` | Pass, all six test files |
| Direct unit execution | 57/57 pass: backend 15, dictionary 11, cache security 1, FEAT-002 10, FEAT-004 6, SQLite 14 |
| `PYTHONPATH=/tmp/vocab-qa-python python3 -m unittest discover -s e2e -p verify.py -v` | 18/18 pass in 22.802 seconds |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| Individual `node --check` | Pass, all 20 JavaScript files |
| `npm audit --json` | Zero known vulnerabilities, 35 dependencies |
| Supplemental favorites checks | All three modes return five/ten favorite targets at the requested limits; invalid filter types rejected |

Source review confirms the renderer now passes `favoritesOnly: true` and no
longer filters an already limited result. The backend validates this as a boolean
and binds its numeric representation to a static SQL predicate before target
sampling. Distractor queries remain global and unchanged. The six supplemental
mode/limit checks used 100 isolated fixture words with ten favorites; the unchanged
Electron regression verifies five favorites among 100 words yield five questions.

Security review of the four-file repair delta found no new security issues:
no IPC channel or authority expansion, no dynamic SQL construction from renderer
input, and no change to text escaping, CSP, storage paths or transaction handling.
The earlier sealed formal security scan applies to `ca71998..b533cd8`; it has not
been relabeled as a scan of the repair. Its reference and the original failed-gate
evidence are retained below. Build/lint and headless runtime limitations below
remain applicable. The nonfatal Python sqlite ResourceWarning also remains.

## Historical first run (superseded by the passing rerun above)

**Initial release gate: FAIL — frontend repair required.** Reviewed immutable application
range `ca71998..b533cd8` on November 4, 2026. The specification must remain
`frontend_integrated` until the favorites quiz regression passes. No production
code was changed during this review.

## Blocking finding

**P2: Filter favorites before limiting the quiz deck.**
`src/renderer.js:1145-1164` sends only `{ limit }` for Favorites Only, asks the
backend for a random quiz across the entire library, and then removes
nonfavorite targets from that already limited result. This can produce a short
quiz or an incorrect empty notice despite enough eligible favorites. It affects
all three modes because filtering occurs before mode-specific rendering.

Real Electron reproduction: import 100 words with distinct definitions and
matching example sentences; mark five as favorites; select Definition Match,
Favorites Only, and 5 Questions; begin the quiz. The regression run returned
**one question instead of five**. SQLite random sampling means the exact short
count varies; a zero-question result is also possible. Source inspection proves
the filter/limit ordering error independently of the sample.

Regression: `e2e/verify.py:test_feat004_favorites_scope_fills_requested_deck`.
Apply favorite eligibility before sampling and limiting target words. A suitable
repair is to document and add a validated backend favorites filter and pass it
from the renderer, retaining global distractor sampling. Rerun all three modes
with many nonfavorites and both five- and ten-question limits. Frontend changes
belong to Gemini under AGENTS.md; any backend contract extension should be
specified before implementation. This is a correctness defect, not a security
vulnerability or a failed security scan.

## Verification results

| Check | Result |
| --- | --- |
| `npm test` | Pass, all six test files |
| Direct unit test execution | 57/57 cases pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| Individual `node --check` | Pass, 20 JavaScript files including E2E harness |
| Real Electron E2E | 17/18 pass; favorites scope regression fails |
| Electron-bundled Node | FEAT-004 6/6 and SQLite storage 14/14 pass |
| `npm audit --json` | Zero known dependency vulnerabilities, 35 dependencies |
| Working diff whitespace check | Pass before recording this report |
| Formal security diff scan | Completed and sealed; zero reportable findings |

Direct cases: backend 15, dictionary 11, FEAT-002 cache security 1, FEAT-002 10,
FEAT-004 6, SQLite 14. Project lint/build commands are syntax checks, not semantic
linting or desktop packaging; each JavaScript file was additionally checked
individually because `node --check` does not validate every positional filename.

The existing E2E fixture expectations were updated for schema v3, 21 named
preload methods, and hydrated organization defaults. Four new integration cases
cover favorites/collection/tag persistence and markup escaping, complete quizzes
in all three modes with real SRS writes, collection-scoped quizzes with SRS
linking disabled, and the failing favorites target-selection invariant. The
previous 14 integration cases continue to pass, including export, lookup,
review-race protection, cached audio/CSP and phone-width overflow.

## Security policy and review coverage

No repository `SECURITY.md` was present. Applied AGENTS.md's ownership and stage
rules and verified the source-established controls. Reviewed all 15 changed
files, including the ten runtime files in the formal scan inventory. Supporting
main-process initialization, dictionary/audio containment and existing regression
tests were inspected as needed. Review was sequential.

- All new IPC channels pass the existing exact trusted-frame guard before
  dispatch. Context isolation, disabled renderer Node access, navigation/new
  window/webview denial and default permission denial remain in place.
- Preload exposes only named wrappers; no raw IPC, SQL or database path is added.
- Tags, collection names, membership IDs and quiz filter values use SQL bindings.
  Schema identifier interpolation uses fixed internal constants/maps.
- Connections enable foreign keys. Collection deletion cascades memberships
  without deleting words. Initialization, tag replacement, import and quiz SRS
  writes use transactions. Failed v2 migrations/imports and failed writes roll
  back; original vocabulary and organization metadata survive relevant tests.
- Quiz text and tags are escaped in HTML/attribute contexts or rendered through
  textContent. The collection ID interpolated into an attribute originates from
  main-process randomUUID generation. A markup-bearing collection name remains
  inert in real Electron, and the existing external-text payload test passes.
- Quiz modes, limits and filter types are validated; cloze literals are escaped
  before regex construction. Distractors are selected in SQL and remain distinct.
  Quiz answer data exposed locally is intentional for this personal learning app.
- No native compilation dependencies were introduced. Database/cache paths are
  fixed under OS userData; renderer text does not choose a storage path.

Formal scan: `fb489af7-9ba2-4f0e-a4cc-2ffea117a424`, immutable range
`ca719989d37d3bc0aa4af02cd89375e8b1247fcb..b533cd8e57d62941dcb5804050acb68ae4cf2624`.
Completed canonical results were read back. Primary report:
`/home/zeto/.codex/state/plugins/codex-security/scans/Vocab-Buddy/b533cd8e57d62941dcb5804050acb68ae4cf2624_20261104T055952Z_0m7e4djh/report.md`.
SARIF is adjacent at `exports/results.sarif`. Plugin-measured rollout usage:
1,848,769 total tokens; 1,842,241 input tokens; 1,771,648 cached input tokens.

## Limits and reproduction

External HTTP uses fixtures. UI actions sometimes dispatch DOM events to avoid
headless compositor stalls; physical mouse, native dialogs, speakers, installed
packages, zero-CLS behavior and power-loss durability are not established. The
unchanged `--no-sandbox` launch flag remains a deployment limitation. An existing
Python sqlite connection emits a ResourceWarning during the E2E run; it does not
cause the assertion failure.

```sh
npm test
npm run lint
npm run build
npm audit --json
python3 -m pip install --target /tmp/vocab-qa-python -r e2e/requirements.txt
PYTHONPATH=/tmp/vocab-qa-python python3 -m unittest discover -s e2e -p verify.py -v
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron src/test/feat004.test.js
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron src/test/sqliteStorage.test.js
```

The E2E harness uses temporary userData and requires permission to execute
Electron and open a localhost debugging socket. The failing regression is
intentionally retained so the repair can be verified against it.
