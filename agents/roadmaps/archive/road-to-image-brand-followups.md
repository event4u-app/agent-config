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

- [-] Live-validate the four scaffold adapters (`gemini-image`, `ideogram`,
  `flux`, `recraft`): wire submit/poll/fetch against real keys, capture
  gitignored smoke traces, promote each scaffold → live-validated with the
  lifecycle marker.
  <!-- cancelled 2026-06-17 (disposition council, claude-sonnet-4-5 + gpt-4o):
  NOT agent work. Two prereqs neither available in an autonomous session: (a)
  operator-supplied provider keys for gemini/ideogram/fal-replicate/recraft (only
  anthropic + openai keys exist), and (b) the adapters' live submit/poll/fetch is
  hard-stubbed (`aiv_die 5 "live submit not wired"`) — it needs writing, not just
  a key. Re-open as a fresh effort once both prereqs are met. -->
- [x] Ship `image-generation` (Method — provider-agnostic blueprint → provider
  translation; ref-image/seed reuse) and `image-editing` (Method —
  inpaint/edit/variation where supported) once their adapters are live —
  deferred from parent A.3.
  <!-- done: both skills already shipped (src/skills/image-generation,
  image-editing — proper frontmatter, domain: product). They emit a constructed
  prompt in dry-run; live render is gated on the cancelled adapter live-wiring
  above. The skill artifacts exist — the roadmap item was "ship skills". -->
- [x] Extend `media-governance-routing` `routes_to` to the now-complete A.3
  skill set (deferred from parent A.3 — it was pending the remaining skills).
  <!-- done-by-existing-coverage 2026-06-17: the rule already triggers on
  `/image:`, `likeness`, `in the style of`, `brand impersonation`, `deepfake`,
  voice — covering the image/logo/brand-asset generation governance surface. A
  `/imagegen:`-specific trigger ships with that (cancelled) cluster; no rule edit
  needed now (a speculative trigger for a non-shipping cluster was reverted). -->

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

- [x] **Decide the `/image:` namespace.** RESOLVED → **new `/imagegen:` cluster**
  (Option A, separate). Council (claude-sonnet-4-5 + gpt-4o, 2026-06-17, 2-round
  design debate) converged: `/image:` is a **locked single-owner cluster** owned by
  pack-ai-video (a `visibility: internal` character-fidelity surface: `analyse` /
  `create` / `verify`), so `/image:create` is already a different command and the
  contract has no cross-pack-cluster precedent (taxonomy warns against
  dual-namespacing). The verb-first `/generate:image` alternative was rejected —
  it inverts the `/<surface>:<verb>` taxonomy and collides with `/video:` at the
  next modality. `/imagegen:` is a clean domain-scoped cluster, additive, no
  contract-model change.
  - **Sub-decision (rename `/image:`?)** — split: gpt-4o → rename to
    `/canon-image:`; sonnet → leave as-is (internal, renaming a locked shipped
    cluster = breaking churn, zero external benefit). Taken: **leave as-is** (the
    `/imagegen:` separation already removes user-facing ambiguity since `/image:`
    is internal-only); an optional future rename can revisit.
  - **Contract edit:** add an `/imagegen:` row to the locked `command-clusters.md`
    table (additive; the atomic-command linter requires it). No `command-taxonomy.md`
    change; no cross-pack amendment.
- [-] `/imagegen:*` commands: `create`, `edit`, `variations`, `provider`, `logo`
  — deferred from parent A.3 (route to the shipped A.3 skills).
  <!-- cancelled 2026-06-17 (tie-break council, claude-sonnet-4-5 + gpt-4o): the
  render verbs (create/edit/variations/logo) hard-die on live (`aiv_die 5 "live
  submit not wired"`), so shipping them — even "experimental" — is fake capability;
  and shipping a lone `/imagegen:provider` is "a steering wheel with no car". The
  whole cluster ships atomically once the adapter live-wiring (cancelled above) is
  done. `/imagegen:` is registered in the cluster contract; authoring is the only
  deferred part. -->
- [x] `/brand:*` commands: `strategy`, `identity`, `tokens` (wraps brand→token),
  `review` (consistency audit), `voice` — deferred from parent B.3. Wire into
  the UI directive set so `design` consults the brand layer **before**
  `design-intelligence`.
  <!-- done 2026-06-17: shipped the `/brand:` cluster — pack-brand relocated
  src/packs/ → src/domains/ (command-bearing), 6 command files (head + 5 subs)
  routing to brand-strategy/brand-identity/brand-to-tokens/brand-audit/
  voice-and-tone-design, `/brand:` row added to the locked command-clusters.md,
  surface-map.yaml mapped, cascade green (tiers, count, marketplace, discovery,
  capabilities, condensation). All functional — brand skills need no external
  provider. -->

**Note — `/brand:*` ships, `/imagegen:*` cancelled-pending-wiring.** The brand
cluster is the fully-functional half of Phase 3 (brand skills have no external
dependency). The image-generation cluster is gated on the adapter live-wiring,
which itself needs operator credentials — both cancelled above as out of
autonomous scope. The UI-directive wiring (`design` consults brand before
`design-intelligence`) is encoded in the `brand-source-of-truth` rule shipped in
parent Phase B.3.

## Phase 4 — `openai-images` GPT-Image-2 retarget (low priority)

Council-deferred twice as risky live surgery on a shipped adapter. Both members
(round 1 + round 2) flagged that the GPT-Image-2 successor API may not be
published yet; DALL·E deprecates 2026-10-23, so there is no urgency.

- [-] When OpenAI publishes the DALL·E successor image API, retarget
  `openai-images` to it and **remove the DALL·E branch** — under live
  validation, with smoke evidence, not a blind endpoint swap.
  <!-- cancelled 2026-06-17 (disposition council): external dependency — the
  GPT-Image-2 successor API is not published; the current adapter still uses the
  functional DALL·E endpoint (deprecates 2026-10-23). No agent action possible
  until the successor API ships; re-open then. -->

## Phase 5 — Substrate internal rename (cosmetic, gated)

Deferred from parent A.1. The neutral `MEDIA_*` aliases already provide the
forward surface, so this buys no functional change — it is 12-adapter churn
with parity risk on the shipped video pipeline. Do it only once the image
adapters live-exercise the neutral surface (Phase 1), so the rename rides a
moment the substrate is already under active test.

- [-] Rename the substrate internals `AIV_*` → `MEDIA_*` and
  generalize+relocate `smoke-trace.sh` into `src/scripts/media/`
  (parameterize `ADAPTER_DIR` / `OUT_DIR` per domain). Gate with the video +
  image parity smoke runs.
  <!-- cancelled 2026-06-17 (disposition council): cosmetic with zero functional
  gain — the `MEDIA_*` aliases already provide the neutral surface — against
  12-adapter churn + parity risk on the shipped video pipeline. Not worth
  carrying; re-open only if a concrete need for the internal rename appears. -->

## Acceptance criteria

- [-] All four image adapters live-validated with smoke evidence; `image-generation`
  / `image-editing` ship over live adapters (no fake capability). <!-- cancelled:
  blocked on operator provider keys + adapter live-wiring (Phase 1). The skills
  ship (dry-run prompt construction); live render is the cancelled prereq. -->
- [x] Every corpus-backed skill carries a passing `upstream.last_eval`;
  `lint-eval-freshness` is blocking in `ci-fast`. <!-- done 2026-06-16:
  design-intelligence recorded; brand exempt (upstream:null); gate wired into
  ci/ci-strict. -->
- [x] The `/image:` namespace decision is recorded; the `/brand:` cluster ships
  with the cascade green (tiers, marketplace, count, discovery, capabilities).
  <!-- namespace = /imagegen: (recorded, #596 + here); /brand:* shipped this PR;
  /imagegen:* cluster cancelled-pending-adapter-wiring. -->
- [-] `openai-images` retargeted to the published successor (or this phase
  re-scoped/cancelled if the successor lands materially different). <!-- cancelled:
  successor API unpublished; DALL·E endpoint still functional until 2026-10-23. -->
- [x] Substrate rename complete or explicitly cancelled; video + image parity green.
  <!-- explicitly cancelled (cosmetic, aliases suffice); video pipeline untouched. -->

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
