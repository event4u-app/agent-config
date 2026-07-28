---
complexity: lightweight
status: ready
parent_roadmap: road-to-gated-reach
---

# Roadmap: Reach — audio transcription when no caption track exists

> The fallback below YouTube captions. Parked behind a blocker that has not been
> reached, because the layer above it has not even been exercised yet.

## Why this is parked, not open

`youtube-transcripts` is itself **parked, unexercised** — `yt-dlp` is absent and
the package never auto-installs. So the caption path has not failed; it has not
run. Building a transcription fallback for a path whose primary has never been
tried would be building for an imagined failure.

Transcription also changes the cost shape entirely: captions are a text download,
transcription is compute or a paid API per minute of audio. That is a different
decision, not a deeper version of the same one.

## Resume trigger

A video task that fails **specifically** because no caption track exists — not
because `yt-dlp` is missing (that is an install), not because the JS runtime is
unconfigured (the doctor reports that as `not-ready` with a fix command), and not
because extraction broke (that is a pin bump). The distinction matters: three of
those four look identical to a caller and only one of them justifies this file.

## What it would have to solve

- A transcription backend, pinned and human-installed, or a paid API with an
  explicit spend gate.
- Honest output labelling: a machine transcript is not a caption track, and a
  summary built on one must say which it used.
- The dedup rule already documented for auto-captions does **not** apply here —
  transcripts have different failure modes (speaker confusion, terminology), and
  those need naming before the channel ships.

## See also

- `docs/guides/gated-platform-reads.md` § YouTube — the primary path and its states.
- `internal/bench/gated-reach/VERDICT.md` § youtube-transcripts — why it is parked, not scored.
