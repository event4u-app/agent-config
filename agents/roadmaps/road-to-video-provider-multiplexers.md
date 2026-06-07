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

- [x] Implement a `fal` adapter against the uniform queue API (`POST queue.fal.run/{model_id}` → poll status → fetch), reusing the `v2` contract. <!-- done: src/scripts/ai-video/adapters/fal.sh — full live submit/poll/fetch wiring (queue.fal.run, stateless job_id encoding model::request, both segments re-validated as tainted), trust boundary via aiv_fetch_url + aiv_validate_artifact_path, <enabled> kill-switch (aiv_provider_enabled in load-config.sh), dry-run fixture; contract tests 68 pass -->
- [x] Parameterize `model_id` so one adapter reaches Kling / Wan2.2 / LTX-2 / Veo / Hunyuan; document the per-model `input` schema differences. <!-- done: optional top-level model_id stdin key overrides XML default-model (council-converged option a); strict charset whitelist, never in a filesystem path; per-model input differences documented in lib/model-capabilities/README.md + contract § model_id -->
- [x] Add a `model-capabilities` manifest per reachable model (`min_duration`, `max_duration`, `audio_sync`, `aspect`) — the music pipeline depends on this to avoid unbuildable variable-length plans. <!-- done: lib/model-capabilities/{fal,replicate}.json (5 models each, verified:false until smoke trace) + capability --model lookup with loud UNVERIFIED stderr warning; locked by tests/test_ai_video_model_capabilities.py (13 pass) -->
- [ ] Capture a real smoke trace; record success-rate + cost; set the lifecycle tier per discipline. <!-- blocked (open, resume later): Hard Floor — needs a live fal key in agents/.ai-video.xml (none present) + per-turn real-spend authorization (non-destructive-by-default); live wiring is complete and routes through the v2 trust boundary --> <!-- carve-out: new-gate-verification -->

## Phase 2 — Replicate multiplexer (priority 2)

- [x] Implement a `replicate` adapter (`POST /v1/predictions` → poll `urls.get`, or `Prefer: wait` for sync) on the same contract shape — near-identical to fal, low marginal cost. <!-- done: src/scripts/ai-video/adapters/replicate.sh — POST /v1/models/{owner}/{name}/predictions → poll GET /predictions/{id} (status mapping starting/processing/succeeded/failed) → fetch output url (string|array|object), prediction id validated as tainted, trust boundary + <enabled> kill-switch; contract tests 68 pass -->
- [ ] Populate its `model-capabilities` manifest; capture a smoke trace. <!-- partial: manifest populated (lib/model-capabilities/replicate.json, 5 models, verified:false) and test-locked; smoke trace blocked (open, resume later) — Hard Floor, needs a live replicate key (none present) + real-spend authorization -->

## Phase 3 — preview/commit mode

- [x] Replace dry-run-as-the-only-default with explicit `preview` (no spend; shows plan + cost) vs `commit` (spends) modes across the video commands, so the safe default is visible intent rather than a silent mock. <!-- done: --mode preview|commit flag (default preview, council-converged option a) in scene/from-script/from-song command.md; preview strictly offline with modeled-cost labeling (no pricing-API calls), commit = existing batch/safety gate then AIV_DRYRUN=false; mandatory mode line opens every report so a defaulted preview never reads as a failed live run -->

## Acceptance criteria

- `fal` and `replicate` each reach ≥3 models through one `model_id` parameter, with captured smoke traces.
- Every reachable model carries a `model-capabilities` manifest.
- Video commands expose explicit `preview` / `commit` modes; cost is shown in preview.
