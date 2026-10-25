---
complexity: lightweight
review_by: 2027-01-25
---

# Stub: media channels measured one by one

> **Stub — not active work.** Created 2026-10-25 by
> `road-to-a-post-the-analysis-can-watch` (Decision 3). It is a stub because it
> needs network, a human-installed `yt-dlp` and bench spend — elapsed-time work,
> not effort.

## Scope

Per channel (`youtube`, `tiktok`, `instagram`, `x-video`, `local-file`), the
gated-reach protocol of `docs/benchmark.md`: six tasks with acceptance evidence
declared up front, a native control arm (the host's own fetch on the same URL;
for `local-file` the host reading the file), thresholds ≥ 5/6 ship · 3–4/6 park ·
≤ 2/6 drop, the control rule (a task leaves the set when the native arm solves
it). A verdict per channel, never aggregated, recorded as a machine-readable
acceptance row `channel, action, backend, passed, item_count, at, source_sha`.
Only that row flips the `video` channel in `src/config/reach-channels.yml` from
`experimental`.

## Trigger

`yt-dlp` installed by a human on the machine that runs the bench — the same
condition `stubs/road-to-youtube-channel-exercise.md` waits on.

## Kill criteria

- A channel scores ≤ 2/6 twice across two yt-dlp pins — drop it from the router
  table and keep the upload path as its answer.
