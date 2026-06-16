---
complexity: structural
status: ready
parent_roadmap: road-to-image-brand-typography
---

# Roadmap: image/brand follow-ons (live validation, commands, retarget)

> Sibling follow-up to `road-to-image-brand-typography` (archived 2026-06-16,
> substance-complete). Holds the items that roadmap deliberately deferred
> because they need **live LLM token spend**, a **product decision**, or
> **live adapter validation** — none of which can be completed autonomously.
> Disposition resolved by a two-round AI council (anthropic/claude-sonnet-4-5
> + openai/gpt-4o, 2026-06-16, design lens): park these five, archive the
> parent.
>
> **Blocked until:** the operator runs the live trigger-eval backfill (Phase 2,
> token spend) and resolves the `/image:` namespace decision (Phase 3). The
> remaining phases are gated behind live adapter validation.

## Goal

Take the image domain from *scaffold-tier, governed, prompt-only* to
*live-validated, command-surfaced, and eval-provable* — without dishonestly
shipping capability over dry-run adapters, and without autonomous token spend.

## Phase 1 — Adapter live-validation + generation/editing skills

Gated behind real-API smoke evidence per `provider-lifecycle-discipline`
(scaffold → live-validated → stable). The council (round 2, both members)
established that shipping `image-generation` / `image-editing` over scaffold
adapters is fake capability: corpus tests validate routing/prompt-grammar
interface correctness, not provider-specific request shape, error modes, or
response parsing — which only live calls exercise.

- [ ] Live-validate the four scaffold adapters (`gemini-image`, `ideogram`,
  `flux`, `recraft`): wire submit/poll/fetch against real keys, capture
  gitignored smoke traces, promote each scaffold → live-validated with the
  lifecycle marker.
- [ ] Ship `image-generation` (Method — provider-agnostic blueprint → provider
  translation; ref-image/seed reuse) and `image-editing` (Method —
  inpaint/edit/variation where supported) once their adapters are live —
  deferred from parent A.3.
- [ ] Extend `media-governance-routing` `routes_to` to the now-complete A.3
  skill set (deferred from parent A.3 — it was pending the remaining skills).

## Phase 2 — Live trigger-eval backfill + ci-fast aggregate flip

<!-- HUMAN-ACTION: live Anthropic token spend, per-skill. Operator-run, not autonomous. -->

- [x] Run `task test-triggers-live -- <skill>` once per corpus-backed skill
  (`design-intelligence` first, then the A/B/C skills) and `eval:record` each
  result so every description-routed skill carries a passing
  `upstream.last_eval` (parent Phase D backfill — the only item left there).
  <!-- done 2026-06-16: operator-run live eval for design-intelligence (router
  anthropic, P/R 1.0/1.0, passed); `eval:record` patched src + dist manifest
  (sha b7e3af80). It is the ONLY SHA-pinned corpus the freshness lint flags;
  `brand` is upstream:null (original-authored) → exempt, no SHA to pin. The
  other A/B/C skills are plain (no SHA-pinned manifest) → out of the gate's scope. -->
- [x] After the backfill records `last_eval` for the SHA-pinned corpora, wire
  `lint-eval-freshness` into the `ci-fast` blocking `deps` aggregate (one-line
  add) so the freshness gate goes blocking. It is intentionally non-blocking
  until the corpora carry a recorded `last_eval`.
  <!-- done 2026-06-16: added `- task: lint-eval-freshness` next to
  `check-trigger-evals` in the `ci` + `ci-strict` aggregates (Taskfile.yml);
  lint now clean so the gate is blocking-safe. Also fixed a Phase-D defect:
  `eval:record` was registered in commander + the registry but omitted from
  main.ts's hardcoded native-dispatch allowlist, so the documented
  `agent-config eval:record` path returned "unknown command" (unit tests pass
  because they call runRecordTriggerEval directly). -->

## Phase 3 — Command clusters + namespace decision

Needs the full command-cluster cascade: relocate `pack-ai-image` + `pack-brand`
from `src/packs/` to `src/domains/` (command-bearing), `lint-command-tiers`,
`.claude-plugin` marketplace command-as-skill entries, `check-command-count`.

- [ ] **Decide the `/image:` namespace** (council split, unresolved). Position A
  (claude-sonnet-4-5): **share** `/image:` — ai-video owns the narrow analysis
  verbs (`verify`, `analyse`), ai-image adds `create`/`edit`/`variations`/
  `logo`/`provider`; verbs self-document scope; commands key on
  `namespace:verb`, so peers can co-contribute. Position B (gpt-4o): **separate**
  `/imagegen:` to avoid collision and keep the surface unambiguous. Resolve
  before authoring the cluster.
- [ ] `/image:*` (or `/imagegen:*`) commands: `create`, `edit`, `variations`,
  `provider`, `logo` — deferred from parent A.3.
- [ ] `/brand:*` commands: `strategy`, `identity`, `tokens` (wraps brand→token),
  `review` (consistency audit), `voice` — deferred from parent B.3. Wire into
  the UI directive set so `design` consults the brand layer **before**
  `design-intelligence`.

## Phase 4 — `openai-images` GPT-Image-2 retarget (low priority)

Council-deferred twice as risky live surgery on a shipped adapter. Both members
(round 1 + round 2) flagged that the GPT-Image-2 successor API may not be
published yet; DALL·E deprecates 2026-10-23, so there is no urgency.

- [ ] When OpenAI publishes the DALL·E successor image API, retarget
  `openai-images` to it and **remove the DALL·E branch** — under live
  validation, with smoke evidence, not a blind endpoint swap.

## Phase 5 — Substrate internal rename (cosmetic, gated)

Deferred from parent A.1. The neutral `MEDIA_*` aliases already provide the
forward surface, so this buys no functional change — it is 12-adapter churn
with parity risk on the shipped video pipeline. Do it only once the image
adapters live-exercise the neutral surface (Phase 1), so the rename rides a
moment the substrate is already under active test.

- [ ] Rename the substrate internals `AIV_*` → `MEDIA_*` and
  generalize+relocate `smoke-trace.sh` into `src/scripts/media/`
  (parameterize `ADAPTER_DIR` / `OUT_DIR` per domain). Gate with the video +
  image parity smoke runs.

## Acceptance criteria

- [ ] All four image adapters live-validated with smoke evidence; `image-generation`
  / `image-editing` ship over live adapters (no fake capability).
- [x] Every corpus-backed skill carries a passing `upstream.last_eval`;
  `lint-eval-freshness` is blocking in `ci-fast`. <!-- done 2026-06-16:
  design-intelligence recorded; brand exempt (upstream:null); gate wired into
  ci/ci-strict. -->
- [ ] The `/image:` namespace decision is recorded; both command clusters ship
  with the cascade green (tiers, marketplace, count).
- [ ] `openai-images` retargeted to the published successor (or this phase
  re-scoped/cancelled if the successor lands materially different).
- [ ] Substrate rename complete or explicitly cancelled; video + image parity green.

## Council notes

Disposition council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-16,
2-round design debate): converged that the parent roadmap is substance-complete
and should archive; items 1/3/4 (live backfill, openai retarget,
generation/editing skills) PARK because they need token spend or live adapter
validation; item 2 (commands) PARK because the cascade is substantial and the
namespace needs a decision; item 5 (rename) PARK as cosmetic-gated. The only
live split is the `/image:` namespace (share vs separate) — carried into Phase 3
unresolved. Round 2 reaffirmed 3+4 must wait: corpus tests prove interface
correctness, not integration correctness, so scaffold-tier adapters cannot back
honest generation skills.
