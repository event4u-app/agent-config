---
complexity: lightweight
---

# Road to Cost-Aware Model Routing

**Goal:** When a dispatched sub-task is small enough for a cheaper model, the
orchestrator spawns the subagent on the lowest-capable tier (`lite|medium|high`
→ haiku/sonnet/opus) instead of the session model — statically per task
category first, then per-slice via a deterministic inference — so routine
mechanical work stops paying frontier-model prices, without regressing quality.

> **Council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
> 2026-07-08, 2 rounds):** M1 static category pinning + M4 telemetry/tripwires
> are the load-bearing foundation and ship first. M2 per-slice tier inference
> is sound ONLY when keyed on the v1 dispatch classifier's task-TYPE output
> (delegable+mechanical → `lite` candidate), never on raw size metrics (diff
> size anti-correlates with difficulty in refactoring domains). M3
> escalate-on-verify-fail goes ONE tier up within the existing N=3 budget
> (economics win vs the session-tier baseline even at ~30% escalation; a
> slice's verify-fail never poisons the orchestrator trajectory — third
> failure marks the slice failed and the orchestrator replans). Round-1 split
> on M1 gating resolved conservatively: read-only categories may ship as
> frontmatter defaults; any tier DOWNGRADE of an existing shipped unit is
> evidence-gated. All M2/M3 quality claims pre-register in the
> orchestration-scope claim scheme before data collection.

## Context — what already exists (do not rebuild)

- **Tier ladder + host mapping (built):** `model_tier: lite|medium|high|inherit`
  is REQUIRED on every subagent unit (ADR-109); `src/scripts/_lib/model_tier.ts`
  maps tiers to `haiku|sonnet|opus` at projection time into
  `.claude/agents/<name>.md` native `model:` frontmatter.
- **Downshift policy (built, inert):** `subagents.downshift: true` +
  `subagents.model_map` in `.agent-settings.yml`; `subagent-routing.md` says a
  sub-task runs on the lowest-capable tier it DECLARES. The orchestrator never
  switches its own session model (`/model` is the user's).
- **Dispatch classification (built, deterministic v1):**
  `src/agent-src/contexts/execution/auto-dispatch-classification.md` decides
  delegable-vs-not from structural signals; LLM classification is v2-deferred.
  It does NOT yet infer a per-slice `model_tier` — tier must arrive
  pre-declared. That inference is the gap this roadmap closes.
- **Verify + budget discipline (built):** `verify-budget.md` (deterministic
  verify for trivial/read-only returns; cross-model judge one tier up for
  substantive returns), N=3 validation budget, `subagent-steering.md` failure
  handling.
- **Telemetry shape (built):** `orchestration-telemetry.md` audit object +
  `agents/runtime/state/audit/YYYY-MM.jsonl`; reference resolvers in
  `src/scripts/_lib/subagent_routing.ts`, `auto_dispatch.ts`,
  `orchestration_gate.ts`.
- **Separate subsystem — do not conflate:** the "~3.3x" lift mechanism is
  `discipline_profile` (ADR-110), a request-scoped RULE-LOADING tier keyed on
  host strength. It is not model routing. The task-difficulty-as-covariate
  analysis for that lever is pre-registered in the discipline-profile
  follow-up roadmap (`road-to-discipline-profile-tiering-followup.md`, active
  on the truth-and-reference-hygiene branch). This roadmap owns the
  model-tier lever only; the two share no code path.

## Prerequisites

- The orchestration evidence gate (`road-to-orchestration-scope-decision.md`,
  active on the truth-and-reference-hygiene branch) is the claim ledger this
  roadmap's quality claims register into — its Phase 1 claim scheme
  (`docs/CLAIMS.md` `unbacked` pre-registration, `check_quality_regression.ts`
  held-quality definition, negative-control discipline) must exist before
  Phase 5 here runs.
- Host with `subagent_spawn: true` in the capability manifest for any live
  measurement (Claude Code: Agent tool with per-call `model` override).

## External evidence base (2026-07-08 web/GitHub research)

- Pre-generation difficulty routing with a tunable quality target: Hybrid LLM
  (arXiv 2404.14618), ~40% fewer large-model calls at held quality.
- Cheap-first cascade + verify + escalate: FrugalGPT (arXiv 2305.05176),
  AutoMix (arXiv 2310.12963). Escalation signal must be an external
  verifier/judge — verbalized self-confidence is the weakest signal
  (arXiv 2502.11021). Our cross-model judge is already paid for, so the
  cascade's usual marginal verifier cost is ~zero here.
- Simple deterministic signals are competitive with trained routers under
  unified eval (LLMRouterBench, arXiv 2601.07206) — a trained
  preference-data router is not worth the dataset + maintenance artifact.
- Agentic caveat: one under-routed step can fail a whole trajectory
  (TwinRouterBench, arXiv 2605.18859) → default-conservative: unknown →
  `inherit`, never guess down.
- Decision-theoretic escalation (arXiv 2605.06350): a task class that
  escalates >~40-50% of the time is cheaper started on the higher tier →
  per-class escalation-rate tripwires, static promotion.
- Community Claude Code practice: static per-subagent `model:` frontmatter
  (search/inventory → haiku; review/architecture → opus) reports 5-10x
  savings (anecdotal); claude-code-router routes on purely mechanical
  signals (background traffic, >60k-token context) with no ML.
- Failure modes to design against: verifier drift silently escalating
  everything (cost 3x); quality regressions are delayed-signal — per-tier
  quality telemetry, not just spend dashboards.

## Rejected up front (council-confirmed — do not revisit without new evidence)

- **Trained preference-data router (RouteLLM-style):** no routing dataset,
  adds a maintained artifact, deterministic signals are competitive on this
  workload class.
- **External proxy routers (claude-code-router / ccproxy):** solve provider
  substitution, not intra-ladder tier choice; the native per-call override
  already exists.
- **LLM-based complexity classifier in v1:** stays v2-deferred exactly as
  `auto-dispatch-classification.md` already records (meta-call cost must be
  justified by Phase-5 evidence first).
- **Self-confidence as escalation signal:** judge verdict only.
- **Raw size metrics (diff size / file count) as standalone tier signals:**
  size anti-correlates with difficulty in refactoring domains; signals enter
  only as guards on top of the v1 task-TYPE classification.

## Phase 0 — Telemetry fields + claim pre-registration (foundation)

- [x] Extend the orchestration telemetry object spec
      (`src/agent-src/contexts/execution/orchestration-telemetry.md`) with
      per-dispatch routing fields: `tier_chosen`, `tier_source`
      (`static|inferred|inherit`), `escalated_from` (nullable),
      `verify_result_by_tier`. Keep PII-exclusion-by-construction — ids and
      enums only, no free-form fields.
- [x] Mirror the fields in the reference resolver
      (`src/scripts/_lib/subagent_routing.ts`) and the
      `readOrchestrationMetrics` aggregator so `/cost:report` can surface
      per-tier spend and escalation rates.
- [x] Pre-register the downshift claim in `docs/CLAIMS.md` as `unbacked`,
      sibling to the orchestration-scope claims: "On the
      mechanical/read-only slice families, tier-downshifted dispatch nets
      ≥30% token-cost reduction at held quality
      (`check_quality_regression.ts` thresholds) vs session-tier dispatch."
- [x] Define the negative control alongside it: an open-ended
      reasoning/architecture slice must NOT be downshifted by any mechanism
      in this roadmap — a router that downshifts everything is a quality
      leak, not a win.

## Phase 1 — M1: static task-type floor (category-level pinning)

- [x] Inventory every shipped subagent unit (`src/subagents/*.md`) and every
      skill/command that declares `model_tier` or dispatches judges; produce
      a category → tier table in the PR description (read-only fan-out /
      inventory / grep → `lite`; mechanical single-file regen or
      template-driven transform → `lite|medium`; implementation → `medium`;
      review / judge / synthesis / architecture → `medium|high`).
      <!-- inventory 2026-07-08: 264 skills tiered (72 high / 90 medium / 100 inherit / 2 lite), 7 judge skills high, 1 subagent unit (production-validator, inherit) -->
- [x] Apply `model_tier` frontmatter for NEW units and for read-only
      categories whose returns get deterministic verification (quality risk
      ~0 by construction). These ship without the evidence gate.
- [x] Any tier DOWNGRADE of an existing shipped unit (e.g.
      `production-validator`) is deferred to Phase 5 — list the candidates
      with expected savings, do not flip them yet.
      <!-- candidates: production-validator inherit→medium (A3 eval measured ~16% cheaper at unchanged outcome, default-off anyway); the 100 model_tier:inherit skills as a bulk re-tier wave (needs the Phase-5 verdict) -->
- [x] Keep the judge asymmetry invariant: the cross-model judge always runs
      one tier ABOVE the implementer tier (existing Iron Law in
      `subagent-orchestration`); document that downshifting an implementer
      never downshifts its judge.
- [x] Update `subagent-configuration.md` + the model-recommendation context
      with the category → tier table so the guidance and the frontmatter
      cannot drift.

## Phase 2 — M4: escalation telemetry + tripwires

- [x] Specify the two tripwires in `subagent-steering.md` (they are steering
      policy, not new mechanisms): (i) per-class escalation rate >40% over a
      rolling window → the class's default tier is wrong; promote it
      statically and log the promotion; (ii) `lite`-tier verify-pass rate
      drops below its trailing baseline → surface a verifier-drift /
      model-drift warning to the user; never silently absorb the cost.
- [x] Add the per-tier quality view to `/cost:report`: spend by tier,
      escalation count by class, verify-pass rate by tier — the
      delayed-signal quality guard the failure-mode literature demands.
- [x] Wire the tripwire evaluation into the reference resolver
      (`subagent_steering.ts`) as a pure function over the audit JSONL, with
      unit tests for both tripwires.

## Phase 3 — M2: deterministic complexity→tier bridge (per-slice inference)

- [x] Extend `auto-dispatch-classification.md` with a tier-inference section
      keyed EXCLUSIVELY on the classifier's existing task-TYPE outputs, not
      raw metrics: delegable + read-only fan-out → `lite`; delegable +
      mechanical/template-driven + test-covered → `lite` candidate with
      `medium` fallback; delegable + mutating without coverage → `medium`;
      delegable + synthesis/judgment → `medium|high`; unknown/ambiguous →
      `inherit` (session tier) — never guess down.
- [x] Size/scope signals (file count, diff surface) enter only as NEGATIVE
      guards (a slice exceeding the size floor loses its `lite` candidacy),
      never as positive downshift evidence.
- [x] Mirror the inference in `auto_dispatch.ts` (`inferSliceTier`, pure,
      no-I/O) with table-driven unit tests covering each mapping row and the
      ambiguous → `inherit` default.
- [x] Record `tier_source: inferred` in telemetry for every M2 decision so
      Phase 5 can score inferred-tier slices separately from static ones.

## Phase 4 — M3: verify-fail escalation (cascade with zero marginal verifier cost)

- [x] Specify in `subagent-steering.md`: a verification FAILURE on a
      downshifted return re-dispatches the slice ONE tier up, counting
      against the existing N=3 budget (attempt 1 `lite` → attempt 2
      `medium` → attempt 3 = slice failed, orchestrator replans at session
      tier). Escalation trigger is the judge verdict / deterministic verify
      result only — never subagent self-confidence.
- [x] Confine the cascade to slices with `tier_source: static|inferred`;
      `inherit` slices keep today's same-tier retry semantics (no behavior
      change outside the downshift path).
- [x] Extend `subagent_steering.ts` + tests: escalation path, budget
      accounting, and the interaction with the existing transient-failure
      retry (transient ≠ verify-fail; only verify-fail escalates).
- [x] Document the economics guard: if Phase 2 telemetry shows a class
      escalating >40%, the tripwire (Phase 2) promotes it statically —
      cascading that class is more expensive than starting high.

## Phase 5 — Evidence gate + disposition

- [x] Build/extend a bench family for the claim: mechanical/read-only slices
      (regen, inventory fan-out, template-driven test generation) run
      downshifted vs session-tier, scored by `check_quality_regression.ts`;
      include the negative control (open-ended architecture slice must route
      `inherit`).
- [x] Run the family on a host with real spawn capability; record per-tier
      tokens + verify outcomes into the audit log (≥20 dispatch lines
      before any verdict, consistent with the orchestration-scope gate's
      telemetry floor).
- [x] Verdict per the pre-registered claim: PROVE → flip the deferred
      Phase-1 downgrades, promote the claim in `docs/CLAIMS.md`, and record
      the disposition; FAIL/NULL → keep static pinning for read-only
      categories only, mark M2/M3 `[-]` with the numbers inline, and record
      the honest null (this package's standing practice).
      <!-- verdict 2026-07-08: FAMILY-SCOPED PROVE (read-only fan-out): 10/10 both arms, 29.4% fewer raw tokens, 76.5% USD-weighted cost cut, negative control held. Deferred Phase-1 downgrades stay deferred — they sit in the UNMEASURED mechanical/review families; flipping them on read-only evidence would be the misrouting failure this roadmap guards against -->
- [x] Disposition note either way in `agents/settings/contexts/` (durable
      conclusion, citable from stable artifacts) — the roadmap itself will
      be archived.

## Acceptance criteria

- Every shipped subagent unit carries an explicit, justified `model_tier`;
  read-only fan-out categories run `lite` by default.
- Telemetry answers, per class: chosen tier, escalation rate, verify-pass
  rate by tier — visible via `/cost:report`.
- The downshift quality claim is registered, measured, and dispositioned
  (proven or honest-null); no default-tier downgrade of an existing unit
  shipped without it.
- The orchestrator's own session model is never auto-switched (unchanged
  invariant); unknown/ambiguous slices always inherit.
- No trained router, no external proxy, no v1 LLM classifier introduced.

## Risks

- **Cascade economics near break-even (council round 1):** at 30-40%
  escalation the lite→medium cascade can flip against a medium-tier
  baseline on pricing shifts — mitigated by the >40% static-promotion
  tripwire and by scoring against the SESSION-tier baseline (the actual
  current behavior), where the cascade wins at ~30% escalation.
- **Trajectory damage from under-routing (TwinRouterBench):** mitigated by
  never-guess-down defaults, slice-boundary escalation (only the verified
  return enters the orchestrator context), and the negative control.
- **Verifier drift silently escalating everything:** mitigated by the
  verify-pass-rate tripwire (Phase 2) surfacing drift instead of absorbing
  cost.
- **M2 collapsing to M1 (dead weight):** possible; Phase 5 scores
  `tier_source: inferred` separately — if inferred routing adds no volume
  over static pinning, M2 is dropped as `[-]` with the numbers inline.
