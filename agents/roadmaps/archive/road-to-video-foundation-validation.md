---
status: ready
complexity: structural
---

# Road to video foundation validation — prove the adapter contract with real money before building anything new

> **AI-council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-06, design mode):**
> validation-first, not feature-first. All five shipped adapters are
> `experimental` with **no real-API smoke trace** — you cannot build a music
> pipeline or new multiplexers on a contract that has never successfully
> called a real API. Two further blockers both members raised independently:
> (1) the `submit/poll/fetch` contract consumes provider-returned filesystem
> paths verbatim (path-traversal / symlink risk), and (2) adapters return no
> cost estimate, which makes the "one preview before spend" UX
> unimplementable. Fix the foundation before anything else.

## Resume state — PAUSED 2026-06-06 (read this first)

> **Status: Phases 1, 3, 4 done + verified. Phase 2 blocked on the maintainer
> (real spend). A fresh agent can continue from here with zero prior context.**
>
> **Done (landed in the working tree / this PR):**
> - **Phase 1 — trust boundary.** `src/scripts/ai-video/lib/adapter-common.sh`
>   gained `aiv_validate_artifact_path`, `aiv_scene_dir`, `aiv_fetch_url`,
>   `aiv_max_artifact_bytes`. `src/scripts/ai-video/stitch.sh` re-validates
>   clip/audio paths before ffmpeg. Contract bumped to **v2**
>   (`src/scripts/ai-video/lib/adapter-contract.md`, "Trust boundary" section +
>   migration note). Locked by `tests/test_ai_video_trust_boundary.py` (13).
> - **Phase 3 — cost transparency.** Optional `cost_estimate` field in contract
>   v2; `--max-spend-usd` kill-switch + cost-sum gate in
>   `src/domains/ai-video/video/from-song/command.md` (Step 8) and
>   `…/from-script/command.md` (Step 5.2).
> - **Phase 4 — adapter disposition.** `docs/decisions/ADR-056-unvalidated-video-adapters-disposition.md`
>   (status: **proposed**) enumerates the 5 unvalidated stubs and surfaces
>   fold/shim/remove + a recommendation. **No adapter deleted** — maintainer picks.
>
> **Verification evidence (re-runnable):**
> `python3 -m pytest tests/test_ai_video_trust_boundary.py tests/test_ai_video_adapter_contract.py`
> → 54 passed, 1 skipped (Phase 3 added `cost_estimate` to the 5 fixtures +
> `test_dry_run_surfaces_cost_estimate` / `test_contract_documents_cost_estimate`).
> `bash -n` clean on both scripts. ADR index fresh
> (`python3 src/scripts/adr/regenerate_index.py --dir docs/decisions --check`).
> Note: `src/scripts/ai-video/test-pipeline.sh` has **pre-existing** unrelated
> reds (missing `compare`/PNG fixtures in a fresh checkout) — verified identical
> on a clean tree via `git stash`; NOT caused by this work.
>
> **To resume — Phase 2 (the only blocker), needs the maintainer:**
> 1. Decide ADR-056 (which adapter to validate first — recommended `gemini-veo`).
> 2. Put a live provider key in `agents/.ai-video.xml` for that provider.
> 3. Authorize the ~10-render real spend (Hard Floor, `non-destructive-by-default`).
> Then wire that adapter's real `submit/poll/fetch` — it **must** route downloads
> through `aiv_fetch_url` and every returned path through
> `aiv_validate_artifact_path` (contract v2 obligation), capture the smoke trace
> under `agents/reference/ai-video/smoke-traces/`, and promote
> `experimental → stable`.
>
> **Then the downstream roadmaps (in order):**
> `road-to-video-provider-multiplexers` → `road-to-music-video-orchestration`
> → `road-to-video-deferred-design` (draft). Strategy + rationale: AI-council
> convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-06 — session artefact
> auto-pruned) and the inline convergence note below.

## Goal

Prove the existing `submit/poll/fetch` adapter contract works end-to-end
against a real provider API, harden its trust boundary, and make cost visible
— so every downstream video roadmap builds on validated ground, not on mocks.

## Why this is the prerequisite

- Dry-run-as-the-default masks that no adapter has ever round-tripped a real
  job. VGTeam reports 98.4% reliability measured on **real** calls; our number
  is unknown.
- The trust-boundary and cost-transparency gaps block both the multiplexer
  pivot and the music pipeline — they are not optional polish.

## Phase 1 — Trust-boundary hardening (blocks all new adapters)

- [x] Audit `src/scripts/ai-video/lib/adapter-contract.md` for the path-trust gap: provider-returned `video_path` / `audio_path` are consumed verbatim. <!-- done: threat-modeled (path-traversal, symlink escape, concat-list injection, unbounded stream); documented in contract v2 "Trust boundary" -->
- [x] Replace raw-path returns with opaque artifact IDs the orchestrator resolves inside a project-scoped output dir; reject paths that escape it (path-traversal + symlink guard). <!-- done: aiv_validate_artifact_path + aiv_scene_dir in adapter-common.sh; stitch.sh re-validates clip/audio paths before ffmpeg; locked by tests/test_ai_video_trust_boundary.py (13 pass) -->
- [x] Size-cap fetched streams; document the cap; bump the contract to `v2` and rerun the adapter fixtures. <!-- done: aiv_fetch_url (--max-filesize default 512MiB / AIV_MAX_ARTIFACT_BYTES + --max-time); contract bumped to v2 with migration note; adapter-contract test 35 pass / fixtures unchanged. -->

## Phase 2 — One real adapter, end-to-end (the smoke trace)

> **Unblocked 2026-06-10:** maintainer picked `gemini-veo` (live Veo key handed
> over in-session) and authorized the spend (single smoke + 10-render batch).

- [x] Pick the single most stable hosted provider already shipped (candidate: `gemini-veo` or `sora`); confirm its terms allow automated calls. <!-- done 2026-06-10: maintainer picked gemini-veo by handing over the live Veo key + authorizing automated validation calls in-session (supersedes the ADR-056 "recommended pick" question for the validation track) -->
- [x] Implement a real `submit→poll→fetch` round-trip and capture the smoke trace under `agents/reference/ai-video/smoke-traces/`. <!-- carve-out: new-gate-verification -->
      <!-- done 2026-06-10: gemini-veo.sh live-wired (predictLongRunning submit → operation poll → fetch via AIV_FETCH_HEADER'd aiv_fetch_url + aiv_validate_artifact_path; operation names taint-validated). Harness gained the live poll-loop + artifact scoping + subshelled validation (3 debug renders burned by the pre-fix harness dying AFTER successful fetch — honest overspend, recorded). 7 harness-captured live traces: agents/reference/ai-video/smoke-traces/gemini-veo-live-2026-06-10T05-3*.json. -->
- [x] Run ~10 real end-to-end renders; record success rate + per-render cost; compare against the VGTeam baseline (98.4% / ~$0.10). <!-- done 2026-06-10: 10/10 server-side renders succeeded (100%); $1.60/render modeled (4s × $0.40/s, durationSeconds=4 ACCEPTED); ~40–70s round-trip; daily-quota ≈10/day caveat (renders 11–12 → HTTP 429 pre-submit, no spend). Full table: agents/reference/ai-video/smoke-traces/README.md § Validation result. -->
- [x] If the validated adapter clears the bar, promote it `experimental → stable` per `provider-lifecycle-discipline` (maintainer-authored tier flip). <!-- done 2026-06-10: maintainer authorized the promotion in-session; gemini-veo flipped to stable in all 3 sync points (adapter header, agents/templates/.ai-video.xml.example, operator's agents/.ai-video.xml); daily-quota caveat recorded in the header; tests 94 pass, harness reports tier=stable -->

## Phase 3 — Cost transparency

- [x] Extend the contract with a `cost_estimate` field on `submit` / `dry-run` (per-job USD, provider-reported or modeled). <!-- done: optional cost_estimate field added to adapter-contract.md v2 stdout shape; unpriceable scenes are `unknown`, never 0; fixtures stay valid (field optional) -->
- [x] Surface aggregate estimated cost in the existing batch cost gate before any live call. <!-- done: from-song Step 8 + from-script Step 5.2 now sum per-scene dry-run cost_estimate at the gate -->
- [x] Add a `--max-spend-usd` kill-switch that hard-blocks once the running estimate crosses the cap. <!-- done: --max-spend-usd flag in both command usage lines; gate hard-blocks before first live call when the summed estimate exceeds the cap (confirmation cannot override) -->

## Phase 4 — Decide the fate of the unvalidated adapters (maintainer decision)

- [x] Enumerate the remaining `experimental` adapters with no smoke trace. <!-- done: all 5 (gemini-veo, higgsfield, kling, openai-images, sora) are experimental stubs with no smoke trace (agents/reference/ai-video/smoke-traces/ absent) -->
- [x] Surface a maintainer decision (NOT autonomous): fold the unvalidated ones behind the multiplexers (next roadmap), keep as thin reference shims, or remove. Record the decision as an ADR. Never delete adapters without explicit maintainer sign-off. <!-- done: surfaced as ADR-056 (status: proposed) with options fold/shim/remove + recommendation; maintainer picks → status accepted. No adapter deleted. -->

## Acceptance criteria

- Adapter contract `v2` closes the filesystem-path trust gap; fixtures green.
- ≥1 provider has a real captured smoke trace plus a measured success-rate + cost number.
- The batch gate shows an estimated cost before spend; `--max-spend-usd` enforced.
- Fate of the unvalidated adapters recorded in an ADR.
