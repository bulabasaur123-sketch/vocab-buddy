# FEAT-002 Stage 4 verification

Release decision: **FAIL — keep `frontend_integrated`**.
Reviewed application range: `7c9b2e3..c08a263`, November 2, 2026.
Production code and feature status were not changed during this review.

## Required Gemini repairs

1. **P1: Cached audio is blocked by CSP** (`index.html:6`,
   `src/renderer.js:153`). The backend returns a valid cached audio data URL,
   but `media-src 'self' https: http:` excludes `data:`. Real Electron reports
   `NotSupportedError` and a `media-src` policy violation. This breaks the
   feature's offline playback requirement. Allow the intended cached media
   representation while preserving script restrictions, then rerun the test.
2. **P2: Missing recordings leave enabled audio controls**
   (`src/renderer.js:363`, `src/renderer.js:183`). With no remote recording or
   local cache, the card still has an enabled “Listen to pronunciation” button.
   Playback falls back to system speech, whose absence motivated this feature.
   Implement the specified disabled state and informative tooltip across the
   lexicon, detail modal, and review deck.
3. **P2: Concurrent audio requests overlap** (`src/renderer.js:138-159`).
   Two calls check `state.activeAudio` before awaiting IPC. Both resume and
   start playback; neither cancels the other. An instrumented Audio consumer
   with the real IPC cache records two active clips. Make pending playback
   requests supersede older requests and clean up previous playing indicators.
4. **P2: Cadence dialog does not own keyboard focus**
   (`src/renderer.js:688-693`). Opening only removes `hidden`; focus stays in
   the background. There is no focus trap, inert background, or focus restore.
   Move focus into the dialog, contain keyboard traversal, and restore focus
   to its trigger when dismissed, including opening from the detail modal.
  If focus remains in the search input, the input guard also prevents Escape
  from reaching the dialog dismissal handler.

These are correctness/accessibility findings, not confirmed exploitable security
vulnerabilities. Frontend repairs remain Gemini-owned under AGENTS.md.

## Verification

- `npm test`: passes all four test files. Direct execution confirms 36 unit
  cases: backend 15, dictionary 10, FEAT-002 10, additional security regression 1.
- `npm run build` and `npm run lint`: pass. Both scripts are syntax checks,
  not packaging or semantic linting; every JavaScript file was also checked
  individually because `node --check` does not process multiple source arguments.
- `npm audit --json`: zero known vulnerabilities in 35 dependencies.
- Final Electron run: **14 tests, 10 pass, 4 fail, zero errors**. The four
  failures reproduce the four required repairs above.
- Electron verification exercises the actual main process, preload, IPC,
  dictionary service, audio cache, store and renderer with isolated userData.
- Added E2E regressions for canonical titles, encountered forms, inflected search,
  cadence dialog, offline media policy, unavailable audio, concurrent playback,
  and dialog focus. Failing regressions intentionally preserve the release gate.
- Feature diff whitespace check reports trailing whitespace in `index.html`
  and spec metadata; new verification changes pass `git diff --check`.

The harness now injects HTTP fixtures through `globalThis.fetch`, replacing an
obsolete mock of the exported dictionary method bypassed by FEAT-002's service
factory. Audio fixtures contain a small valid PCM WAV recording. Functional
checks use DOM click events to avoid headless compositor actionability stalls;
delete confirmation is accepted by a renderer fixture because native confirmation
is unreliable on headless Ozone. Physical mouse/native dialog behavior is not
claimed verified. Concurrent playback uses an instrumented Audio constructor;
the CSP test uses the real Chromium Audio implementation. Live provider uptime,
real speakers, packaged distribution and zero-CLS behavior remain unverified.

## Security checks and formal scan limitation

Reviewed all 15 changed files and supporting storage/store/renderer boundaries.
Trusted-frame validation protects all named IPC handlers. The audio API accepts
headwords rather than caller-supplied paths, rejects traversal and symlink reads,
and returns bounded base64 with fixed audio MIME types. Download host allowlisting,
HTTPS-only URLs, credential/port rejection, redirect rejection, streamed size
limits and atomic publication constrain external recordings. The added regression
checks traversal, symlinks, hostile host suffixes, credentials, nondefault ports,
and the inclusive 102400-byte ceiling. External rendered text is escaped.
No new exploitable security vulnerability was confirmed in this source review.
The existing `--no-sandbox` startup remains a deployment limitation.

The Codex Security plugin scan is **not finalized**. Scan
`ee182cb9-9889-4857-9e6c-cf56cdb0e8d5` preserves the exact diff target and preflight
context. Its canonical draft writer rejects `/home/zeto/.codex` (mode 775):
“Scan output parent must not be group- or world-writable without the sticky bit.”
No global permissions were changed, no replacement scan was started, and no
sealed security report is claimed. Resume that scan after its storage ownership
issue is resolved. This file is the repository's Stage 4 verification record.

## Reproduce

```sh
python3 -m pip install --target /tmp/vocab-qa-python -r e2e/requirements.txt
PYTHONPATH=/tmp/vocab-qa-python python3 -m unittest discover -s e2e -p verify.py -v
npm test
npm run build
npm run lint
npm audit --json
```

The Electron run requires execution permission and localhost debugging sockets.
Rerun all checks after Gemini repairs before changing status to `ready_to_ship`.
