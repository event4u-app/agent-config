---
status: ready
complexity: structural
parent_roadmap: road-to-video-provider-multiplexers
---

# Road to music-video orchestration — real audio analysis, modality-switch direction, sparse lip-sync

> **AI-council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-06, design mode):**
> keep this IN the existing video domain (no separate pack) — audio analysis
> ships as a provider ADAPTER, not bundled local Python deps; bundling ML deps
> would violate the "skill suite, not an app" constraint. Adopt the music2video
> orchestration pattern (beat-driven variable-length segmentation + per-segment
> lyric↔audio modality switch + energy→intensity), modernized. Generalize the
> existing vocal-map sign-off into ONE storyboard/cost preview gate over ALL
> prompts. Replace the proposed `creative-brief` broadcast with a new skill,
> `prompt-validator`, that blocks on contradiction (skills are
> deterministic — the risk is contradiction, not drift). Lip-sync is a separate
> post-process adapter, sync.so hosted first, kept sparse (singing lip-sync is
> genuinely hard). Depends on the multiplexers' `model-capabilities` manifest.

## Goal

Turn `/video:from-song` from energy-segmentation-with-honesty-caveats into a
real music-director pipeline: beats / sections / lyrics drive the cut and the
shot, every prompt is gated once before spend, and lip-sync is applied only
where it holds up.

## Phase 1 — Audio-analysis adapter (real beats / structure)

- [ ] Define an audio-analysis adapter contract: stdin audio → stdout `{bpm, beats, downbeats, sections:[{start,end,label}]}` JSON.
- [ ] Ship a reference adapter backed by an `allin1`-class analyzer (BPM + beats + downbeats + named sections in one pass), run on a separated vocal stem.
- [ ] Keep `probe-audio.sh` as the zero-dependency fallback; the adapter is the upgrade path, never a hard requirement.

## Phase 2 — Lyrics + singer adapter

- [ ] Define a lyrics adapter: stdin vocal stem → stdout word-level timestamps + per-line speaker (WhisperX-shape: forced alignment + diarization), feeding the existing `vocal-map.json`.
- [ ] Enforce the `media-sync-ground-truth` Iron Law in code: lyric timing + singer derive only from the transcribed stem; ambiguous lines surface as `singer: "?"`.

## Phase 3 — Modality-switch direction

- [ ] In `song-to-script`, switch per segment: a segment carrying lyrics → scene prompt from the lyric line; an instrumental segment → scene prompt from audio features (section label + energy).
- [ ] Couple section energy → cut frequency + motion intensity (chorus = faster cuts / more motion).
- [ ] Constrain each segment's duration to the chosen model's `model-capabilities` (merge / clamp beats to renderable lengths) — no unbuildable plans.

## Phase 4 — Unified preview gate + prompt-validator

- [ ] Merge the vocal-map sign-off and the batch cost gate into ONE storyboard/cost preview (shot list + per-shot prompt + total estimated cost) shown before any spend.
- [ ] Add a new skill, `prompt-validator`, that runs before the gate: collect every prompt in the run, block on contradiction (style / character / physics mismatch) with a specific error.

## Phase 5 — Lip-sync post-process adapter

- [ ] Define a lip-sync adapter (stdin video + audio-line → stdout lip-synced clip); ship a `sync.so`-class hosted reference first (singing-capable, no GPU). <!-- carve-out: new-gate-verification -->
- [ ] Codify the sparse-lip-sync budget as enforced constraints (max segments per song, frontal-close-up-only, cost gate) — the rest stays cinematic motion (DoP).

## Acceptance criteria

- `/video:from-song` produces a beat-driven plan with real BPM / sections (adapter present) or the honest fallback (adapter absent), never silently mislabeled.
- One storyboard/cost preview gates all spend; `prompt-validator` blocks contradictions before any live call.
- Lip-sync is an opt-in post-process bounded by an enforced budget.
