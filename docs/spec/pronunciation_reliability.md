# Pronunciation reliability — approved implementation

User approved: verified local recordings, automatic provider fallbacks, Settings
repair for existing vocabulary, and quiet inline playback feedback. No synthesized
speech, database schema changes or alteration of vocabulary/Leitner data.

- Candidate recordings come from saved metadata, Dictionary API phonetics, and
  English Wiktionary audio. Try a bounded list across recordings/providers; retain
  HTTPS allowlisted hosts, no redirects, 10-second request timeout and 100KB cap.
- Verify supported audio headers and reject HTML/JSON before atomic publication.
  Existing cache files must pass the same check. Filename .mp3 may hold Ogg/WAV;
  preserve detected MIME rather than transcoding.
- Existing words can explicitly ensure pronunciation by headword. Persist only
  audio metadata through a targeted update, preserving review/citation/organization.
  Deleted words must not be recreated by late requests. Coalesce same-word work.
- Trusted IPC: ensurePronunciation(word) -> {status,dataUrl?};
  repairPronunciations() -> {checked,repaired,available,unavailable}.
  The repair walks saved entries with bounded concurrency and no automatic
  playback. No cached audio is discarded because the network is unavailable.
- Speaker states: find/retry, loading, playing, unavailable. Missing recordings can
  be requested with the same speaker control. Text feedback is adjacent and live;
  never imply a playable recording based on a URL alone. Automatic quiz playback
  uses archived recordings only. No startup download storm or provider polling.
- Settings provides one explicit repair action and a concise result summary.
  Saved-local recordings remain available offline. Providers cannot guarantee all
  words; unavailable results retain a deliberate retry action.

Acceptance: reject successful HTTP HTML/invalid bytes; recover from dead saved
URLs and alternate dialect/provider failures; cache survives restart; targeted
repair preserves other fields and deleted words; untrusted IPC rejected; playback
failure announced, retry works, and rapid requests cannot overlap playback.
