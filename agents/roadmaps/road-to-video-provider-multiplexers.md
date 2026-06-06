---
status: ready
complexity: structural
parent_roadmap: road-to-video-foundation-validation
---

# Road to video provider multiplexers — one adapter, many models (fal first, Replicate second)

> **AI-council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-06, design mode):**
> adopt the multiplexer pivot. Hosted aggregators (fal.ai, Replicate) each
> expose ONE uniform async queue API over dozens of video models (Kling,
> Wan2.2, LTX-2 with audio-sync, Veo, Hunyuan). One adapter multiplexes many
> models via a `model_id` parameter, so we stop hand-building first-party
> single-model adapters. Direct Kling / Luma / Runway adapters are **rejected**
> — they ride the aggregators. ComfyUI (local) is explicitly **deferred** (see
> the deferred-design roadmap) until its arbitrary-Python sandbox is designed.
> Depends on the foundation-validation roadmap (validated contract + trust
> boundary + cost field).

## Goal

Give the suite hosted-easy reach over the whole modern video-model landscape
through two multiplexer adapters that reuse the validated contract — so "anyone
can generate video" needs only an API key, no GPU.

## Phase 1 — fal.ai multiplexer (priority 1)

- [ ] Implement a `fal` adapter against the uniform queue API (`POST queue.fal.run/{model_id}` → poll status → fetch), reusing the `v2` contract.
- [ ] Parameterize `model_id` so one adapter reaches Kling / Wan2.2 / LTX-2 / Veo / Hunyuan; document the per-model `input` schema differences.
- [ ] Add a `model-capabilities` manifest per reachable model (`min_duration`, `max_duration`, `audio_sync`, `aspect`) — the music pipeline depends on this to avoid unbuildable variable-length plans.
- [ ] Capture a real smoke trace; record success-rate + cost; set the lifecycle tier per discipline. <!-- carve-out: new-gate-verification -->

## Phase 2 — Replicate multiplexer (priority 2)

- [ ] Implement a `replicate` adapter (`POST /v1/predictions` → poll `urls.get`, or `Prefer: wait` for sync) on the same contract shape — near-identical to fal, low marginal cost.
- [ ] Populate its `model-capabilities` manifest; capture a smoke trace.

## Phase 3 — preview/commit mode

- [ ] Replace dry-run-as-the-only-default with explicit `preview` (no spend; shows plan + cost) vs `commit` (spends) modes across the video commands, so the safe default is visible intent rather than a silent mock.

## Acceptance criteria

- `fal` and `replicate` each reach ≥3 models through one `model_id` parameter, with captured smoke traces.
- Every reachable model carries a `model-capabilities` manifest.
- Video commands expose explicit `preview` / `commit` modes; cost is shown in preview.
