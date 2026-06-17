---
adr: 056
status: accepted
date: 2026-06-06
decision: unvalidated-video-adapters-disposition
supersedes: —
superseded_by: —
phase: video foundation validation (road-to-video-foundation-validation, Phase 4)
type: structural
---

# ADR-056 — Disposition of the five unvalidated AI-video adapters

## Status

**Accepted** · 2026-06-10 (maintainer decision, in-session). Outcome: the
alternative this draft originally rejected as wasteful — **validate all
five** — is what the maintainer chose interactively, and it was the right
call: provider keys were at hand, total validation spend stayed ~$30, and
the live runs exposed real contract bugs in four adapters (Kling keypair/JWT
auth, Replicate community-model create route, fal server-side duration
validation, Higgsfield auth-header/upload/poll shapes — re-read from the
official higgsfield-js SDK) that mocks could never have caught.

**Disposition: all five validated, all five kept, all five promoted
`experimental → stable`** (none removed; option A's removal rationale
dissolved once every adapter actually worked):

| Adapter | Validation | Promotion |
|---|---|---|
| `gemini-veo` | 10/10 renders (native audio) | stable (PR #457) |
| `kling` | 1/1 (keypair/JWT rework) | stable (PR #459) |
| `sora` | 1/1 (newly wired, OpenAI Videos API, native audio) | stable |
| `openai-images` | 2/2 (sync adapter; real PNGs) | stable |
| `higgsfield` | 1/1 image2video (SDK-corrected upload/auth/poll) | stable |

The multiplexers (`fal`, `replicate` — also validated 3 models each, also
stable) remain the preferred batch path; the per-model adapters are now
honest, validated direct integrations rather than dead stubs.

Original proposal text below is retained for provenance.

---

## Context

Five adapters ship under `src/scripts/ai-video/adapters/`:
`gemini-veo`, `higgsfield`, `kling`, `openai-images`, `sora`. All five are:

- `lifecycle: experimental` — structural shape conformant only;
- **stubs** — `submit`/`poll`/`fetch` each `aiv_die 9 "live … not yet wired"`; only `dry-run` (committed fixture) works;
- **never validated** — `agents/reference/ai-video/smoke-traces/` does not exist; no adapter has ever round-tripped a real API call.

The AI council flagged this as the foundation risk: downstream roadmaps
(`road-to-video-provider-multiplexers`, `road-to-music-video-orchestration`)
proposed shimming or falling back to these adapters — but you cannot shim or
fall back to code that has never worked. Both members independently raised it;
one recommended "delete four, validate one." Deletion is destructive and is the
maintainer's call (per `non-destructive-by-default`), hence this ADR rather than
an autonomous removal.

The provider strategy also changed the calculus: the multiplexer roadmap
adopts **fal.ai + Replicate** aggregator adapters, each reaching Kling / Wan2.2 /
LTX-2 / Veo / Hunyuan through one `model_id`. That makes the per-model
`kling` / `gemini-veo` / `sora` adapters largely redundant once the
aggregators land — they would ride the multiplexers instead.

## Decision (proposed — maintainer picks)

Validate one first, then choose the disposition of the other four:

1. **Validate one end-to-end.** Pick the single most stable shipped provider
   (candidate: `gemini-veo` or `sora`), wire its real `submit/poll/fetch`
   through the contract-v2 trust-boundary helpers (`aiv_scene_dir`,
   `aiv_fetch_url`, `aiv_validate_artifact_path`), capture a smoke trace under
   `agents/reference/ai-video/smoke-traces/`, and promote it `experimental →
   stable`. This proves the contract before any multiplexer is built.

2. **Disposition of the remaining four — choose one:**
   - **(A) Remove** the per-model video stubs (`kling`, plus whichever of
     `gemini-veo`/`sora` was not validated) once the fal/Replicate multiplexers
     reach the same models. Keep `openai-images` (image path, still used by the
     image render step) and the one validated video adapter. *Recommended* —
     least dead code, no shim-to-nothing.
   - **(B) Keep as thin reference shims** — retain one stub as a documented
     "minimal adapter" example, delete the rest.
   - **(C) Keep all, relabel** — leave the stubs in place, clearly marked
     `experimental · unwired`, and let the multiplexers supersede them over time.

**Recommendation:** validate `gemini-veo` (native-audio, relevant to music
video), then path **(A)** — remove `kling` and `sora` stubs once the fal
multiplexer reaches them, keep `openai-images` + validated `gemini-veo`.
`higgsfield` is the only one with a distinct capability not covered by the
aggregators (the `speak` lip-sync hook); keep it pending the lip-sync adapter
decision in the music-video roadmap.

No adapter is removed without explicit maintainer sign-off in this ADR
(status → accepted with the chosen path).

## Consequences

- **If accepted:** the suite stops carrying four never-run code paths as
  "foundation"; the multiplexers become the single video path; `higgsfield`'s
  lip-sync hook is the one first-party capability retained.
- **Trade-off:** removing per-model adapters loses the (theoretical) option of a
  direct provider integration without an aggregator key. Mitigated — the
  aggregators reach the same models, and ComfyUI (deferred) covers the
  local-free path.
- **Until decided:** the stubs stay; the multiplexer roadmap must NOT shim to
  them (they would `aiv_die 9`).

## Alternatives considered

- **Validate all five before deciding** — rejected: wasteful given the
  aggregators supersede most of them; validate one to prove the contract, then
  decide.
- **Autonomous deletion of four** — rejected: destructive, maintainer's call.

## References

- `road-to-video-foundation-validation.md` (Phase 4) — the step this ADR closes.
- `src/scripts/media/lib/adapter-contract.md` (v2) — the trust-boundary helpers a validated adapter must use.
- `provider-lifecycle-discipline` rule — the `experimental → stable` promotion gate.
- AI council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-06): validation-first; multiplexer pivot supersedes per-model adapters.
