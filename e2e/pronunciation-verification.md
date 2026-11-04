# Pronunciation reliability verification

Implemented the approved first four recommendations: local format-checked cache,
alternate provider/dialect candidates, explicit Settings repair, and quiet inline
feedback using existing speaker controls. Device speech remains deferred.

- All seven unit files pass (64 cases: existing 57 plus seven new tests).
- All 26 Electron E2E scenarios pass, including three pronunciation scenarios.
- Project lint/build and individual JavaScript syntax checks pass.
- New tests cover HTTP-200 HTML/invalid bytes, corrupted cache detection, dead saved
  URLs, provider fallback, same-word/repair coalescing, offline reuse, targeted
  metadata preservation, deleted/replaced-record races, and trusted IPC checks.
- E2E verifies Settings repairs only audio metadata, unavailable recordings retain
  a quiet retry action, and playback rejection clears loading and announces failure.
- The former disabled-missing-audio test now verifies deliberate recording lookup.
  Synthetic zero-buffer audio fixtures were replaced with recognizable headers.
- The incoming fixed-grid layout commit was preserved. Inline feedback spans the
  metadata grid rather than changing its star/speaker/cadence column alignment.

No database schema, citations, definitions, tags, collections or review algorithm
changes. Existing audio URL/local metadata columns are updated using bound SQL.
Cache/media verification recognizes MP3/Ogg/WAV headers; it is not a full codec
validation pass. Renderer decode/playback failures are handled separately.

Network responses are hermetic in the automated suite. Source availability, audio
output hardware and every provider recording are not guaranteed. Downloads remain
limited to 100KB and allowlisted HTTPS hosts without redirects. Format validation
may reject previously accepted non-audio files; it never removes vocabulary.

Reproduce: npm test; npm run lint; npm run build;
PYTHONPATH=/tmp/vocab-qa-python python3 -m unittest discover -s e2e -p verify.py -v.
