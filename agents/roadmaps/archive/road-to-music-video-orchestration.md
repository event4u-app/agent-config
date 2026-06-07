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

- [x] Define an audio-analysis adapter contract: stdin audio → stdout `{bpm, beats, downbeats, sections:[{start,end,label}]}` JSON. <!-- done: src/scripts/ai-video/lib/audio-adapter-contract.md (v1) — separate filter-shape contract per council 2026-06-07 (Q1a: sync analyze|capability|dry-run, NOT the v2 queue triple); exit codes aligned with v2 + 75 transient; trust boundary explicit; locked by tests/test_ai_video_audio_adapters.py -->
- [x] Ship a reference adapter backed by an `allin1`-class analyzer (BPM + beats + downbeats + named sections in one pass), run on a separated vocal stem. <!-- done: src/scripts/ai-video/audio-adapters/allin1.sh wraps the OPERATOR-installed allin1 CLI (no bundled ML deps; stems separated internally by allin1/demucs); dry-run fixture lib/fixtures/allin1/analysis.json; contract tests pass -->
- [x] Keep `probe-audio.sh` as the zero-dependency fallback; the adapter is the upgrade path, never a hard requirement. <!-- done: probe untouched; fallback semantics council Q4(c) codified in contract § Fallback + wired into from-song Step 2 (unconfigured→probe normal path; transient→retry once→probe with ONE warning; config failure→hard-fail actionable) -->

## Phase 2 — Lyrics + singer adapter

- [x] Define a lyrics adapter: stdin vocal stem → stdout word-level timestamps + per-line speaker (WhisperX-shape: forced alignment + diarization), feeding the existing `vocal-map.json`. <!-- done: lyrics class in audio-adapter-contract.md (lines[].speaker = raw diarization label or "?") + src/scripts/ai-video/audio-adapters/whisperx.sh reference (operator-installed CLI, mixed-speaker line → "?"); fixture lib/fixtures/whisperx/transcript.json carries a "?" line by design; song-to-script Step 3 consumes it adapter-first -->
- [x] Enforce the `media-sync-ground-truth` Iron Law in code: lyric timing + singer derive only from the transcribed stem; ambiguous lines surface as `singer: "?"`. <!-- done: src/scripts/ai-video/lib/validate-vocal-map.sh — mechanically rejects re-timed lines (tolerance 0.25s), lyrics absent from the transcript, and missing singers; optional --roster allows cast∪{"?"} only; wired BEFORE the 6a sign-off gate in from-song + song-to-script Step 3.4; 7 validator tests in tests/test_ai_video_audio_adapters.py -->

## Phase 3 — Modality-switch direction

- [x] In `song-to-script`, switch per segment: a segment carrying lyrics → scene prompt from the lyric line; an instrumental segment → scene prompt from audio features (section label + energy). <!-- done: SKILL.md Step 2 "modality switch" — lyric segment prompts from the line's imagery (character/style mode aware), instrumental from label+energy intent table (now incl. verse/chorus/bridge musical labels); Step 5 validates no cross-segment lyric recycling -->
- [x] Couple section energy → cut frequency + motion intensity (chorus = faster cuts / more motion). <!-- done: SKILL.md Step 2 energy table — ≥mean+0.10 → split toward min_duration on downbeat bars + fast camera; ±0.10 → medium; ≤mean−0.10 → merge toward max_duration + locked-off/drift; always inside the Step 1 envelope -->
- [x] Constrain each segment's duration to the chosen model's `model-capabilities` (merge / clamp beats to renderable lengths) — no unbuildable plans. <!-- done: SKILL.md Step 1 reads min/max_duration from `capability --model` manifest (verified:false surfaced); beat/downbeat-aligned merge+split rules; "no valid plan" → halt with model id + violated bound; Step 5 asserts the envelope -->

## Phase 4 — Unified preview gate + prompt-validator

- [x] Merge the vocal-map sign-off and the batch cost gate into ONE storyboard/cost preview (shot list + per-shot prompt + total estimated cost) shown before any spend. <!-- done: from-song Step 8 unified preview table (shot list · vocal map · providers/tiers · per-scene+total modeled cost); 6a sign-off folded in — approving the preview IS the vocal-map sign-off + cost confirmation, one literal-yes in commit mode, preview mode stops offline -->
- [x] Add a new skill, `prompt-validator`, that runs before the gate: collect every prompt in the run, block on contradiction (style / character / physics mismatch) with a specific error. <!-- done: src/skills/prompt-validator/SKILL.md (pack ai-video, experimental) — full-batch collection, style/character/physics/lip-sync-ownership classes, block-with-specific-error verdict, no auto-fix, re-validate after hand-edits; wired into from-song frontmatter skills + Step 8 before the unified preview; skill linter passes (1 WARN, style-level) -->

## Phase 5 — Lip-sync post-process adapter

- [x] Define a lip-sync adapter (stdin video + audio-line → stdout lip-synced clip); ship a `sync.so`-class hosted reference first (singing-capable, no GPU). <!-- carve-out: new-gate-verification --> <!-- done: adapter-contract.md v2 § kind="lipsync" ({video_url,audio_url,model_id} stdin, https-only, audio_embedded:true) + src/scripts/ai-video/adapters/syncso.sh (submit→poll→fetch on api.sync.so v2/generate, ASSUMED-tagged fields, trust boundary, kill-switch, dry-run fixture); passes the full v2 contract suite (79 tests) — ran once locally per carve-out -->
- [x] Codify the sparse-lip-sync budget as enforced constraints (max segments per song, frontal-close-up-only, cost gate) — the rest stays cinematic motion (DoP). <!-- done: machine-readable lipsync_budget block in lib/model-capabilities/syncso.json (max_segments_per_song:4, max_segment_seconds:15, frontal_close_up_only, cost_gate) per council Q5(a); from-song Step 8 enforces all four BEFORE any submit (halt + manifest-diff override path, prompt-validator rejects non-frontal lip-sync shots); locked by tests/test_ai_video_lipsync_budget.py (5 tests) -->

## Acceptance criteria

- `/video:from-song` produces a beat-driven plan with real BPM / sections (adapter present) or the honest fallback (adapter absent), never silently mislabeled.
- One storyboard/cost preview gates all spend; `prompt-validator` blocks contradictions before any live call.
- Lip-sync is an opt-in post-process bounded by an enforced budget.
