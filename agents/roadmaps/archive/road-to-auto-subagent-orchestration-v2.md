---
complexity: structural
status: ready
parent_roadmap: road-to-auto-subagent-orchestration
---

# Road to auto-subagent-orchestration v2 — make it real: trigger, bundle, synthesis

> Deepen the shipped lean v1 (PR #642) from *documented activation* to *wired
> behaviour*: a dedicated auto-trigger rule (A1), a bundle resolver bound to the
> real role / profile / knowledge registries (A2), and a structured
> subagent-response envelope feeding synthesis (A3). The heavy work_engine
> integration (A4) and extra policy knobs (A5) are explicitly out of scope here.

## Goal

v1 shipped the auto-subagent layer as **contexts + pure helpers + settings +
skill-prose activation** — deliberately lean (ADR-105: "activate, don't
fragment", minimal-diff, prove-before-default-on). Three verified gaps keep it
from being *real* rather than *documented*:

- **A1** — auto-dispatch fires only via two skill-prose paragraphs; there is no
  loadable rule that proactively makes the orchestrator decompose + delegate.
- **A2** — `composeSpawnBrief` is abstract: it accepts role / persona / knowledge
  as input, bound to **nothing**. The user's 3rd original motivation
  ("Rolle/Profil/Wissen pro Aufgabe") is contract-only, not wired.
- **A3** — subagent returns carry only a 4-status taxonomy; there is no
  structured findings/evidence/confidence envelope for the orchestrator to
  synthesise + re-verify.

This roadmap closes A1–A3. It does **not** introduce the work_engine `/work`
integration (A4) or the `policy`/`min_task_signal` knobs (A5).

> **Council-decided (deep, design mode, 2026-06-23).** The anthropic member's CLI
> transport timed out (curl ETIMEDOUT) — this round is **openai/gpt-4o + host
> critical-evaluation** (the host lens is codebase-grounded, which the external
> member is not), not a two-member convergence. Full report + host verdict at the
> end; trace `agents/runtime/council/responses/auto-subagent-orchestration-v2.json`.
> Verdict: **A1 build · A2 build (highest-leverage) · A3 build, scoped · A4 reject
> → own ADR · A5 reject · benchmark gate stays Phase 0.**

## Constraints (inherited, non-negotiable)

- **ADR-035 tier-space only** — no runtime `model→band`/`model→quota` table; no
  vendor-keyed settings. The CI guard from v1 still applies.
- **Multi-tool portability** — clean no-op where the host has no subagent primitive.
- **Safety floors** — verify-before-complete, cross-model judge Iron Law, N=3
  budget, lethal-trifecta / ADR-100 (no proprietary knowledge across project
  boundaries) — never lifted.
- **Frugality** — no lever ships on an unmeasured claim; the benchmark gate (v1
  follow-up) is the evidence Phase 0 below depends on.
- **Source of truth `src/`**; condense via `/condense`; minimal-safe-diff.

## Phase 0 — Benchmark gate dependency (no new work here)

> The council put the deferred benchmark first. It is **not re-built here** — it
> is the existing follow-up's job. This phase is a dependency marker.

- [x] Confirm the benchmark + default-flip from
      `road-to-auto-subagent-orchestration-followup.md` is the Phase-0 evidence
      gate for the aggressive parts of A1 (auto-fire) — A1's rule may ship in
      `ask`-equivalent posture before the benchmark, but the default-on-fire
      behaviour stays gated on that benchmark, not re-litigated here.

## Phase 1 — A1: dedicated auto-trigger rule

> Council: **build.** A loadable rule is more reliable + auditable than prose.

- [x] **1.1** New `src/rules/delegation-policy.md` (Tier-2, router-loaded on
      match — NOT kernel/always; keep the always-budget flat). It cites
      `contexts/execution/auto-orchestration-activation.md` +
      `auto-dispatch-classification.md` and makes binding: when the activation
      gate clears, decompose the task, tier-size each slice, dispatch — instead
      of doing it all in-session. Honors `subagents.auto` (`ask`→ask once,
      `on`→one-line surface, `off`/no-primitive→no-op).
- [x] **1.2** Trim the v1 skill-prose activation in `subagent-orchestration` +
      `reasoning-orchestrator` to **point at** the rule (single source of truth),
      not duplicate the trigger logic (preservation-guard: keep the Iron Law +
      RDP section intact).
- [x] **1.3** Register the rule's trigger-set so the router loads it under the
      `balanced`/`full` profiles; add `evals/triggers.json` (5 should / 5
      should-not) per the rule-authoring contract.
- [x] **1.4** `/condense` the rule + verify it lands in `dist/router.json` as
      tier-2 (not kernel); always-budget unchanged.
- [x] **1.5** Verify: a trigger-eval fixture shows the rule fires on a
      declared-parallel / multi-slice task and stays silent on a trivial one.

## Phase 2 — A2: bundle resolver bound to the real registries (highest-leverage)

> Council: **build, minimal slice** — wire to what exists, no parallel registry.
> Named the single highest-leverage item.

- [x] **2.1** Resolver `src/scripts/_lib/subagent_bundle.ts` that maps a task
      slice → a concrete bundle by reading the EXISTING surfaces (no new
      `roles.yml`): role-mode / business role from `agents/roles/` + profile from
      `src/agent-src/profiles/*`, the cited personas, and `model_tier`. Feeds
      `composeSpawnBrief` real values instead of abstract inputs.
- [x] **2.2** Reuse the `judge-*` skills as ready-made subagent role-profiles:
      a review slice → `judge-code-quality`, security → `judge-security-auditor`,
      tests → `judge-test-coverage`, bug-hunt → `judge-bug-hunter`. The resolver
      picks the lens per slice instead of a generic judge.
- [x] **2.3** Knowledge binding: attach only the minimal relevant knowledge-card
      **refs** (not bodies) per slice. **ADR-100 guard:** `tier: proprietary`
      cards never enter a cross-project-visible subagent context;
      `knowledge.global_sharing` stays the master gate. Keep `composeSpawnBrief`'s
      ref-only + cap invariant.
- [x] **2.4** Audit signature: each resolved bundle emits an auditable
      `(role, knowledge-refs, tier)` line into the orchestration-telemetry object
      (counts/ids only, no bodies).
- [x] **2.5** Verify: tests for the resolver — a security slice resolves to the
      security lens + tier; a proprietary card is refused into a cross-project
      bundle; an unknown role degrades to null (no spawn-blocking).

## Phase 3 — A3: structured subagent-response envelope + synthesis duties

> Council: **build, scoped** — confidence-gated re-verify folds into the existing
> verify budget; no large structural change.

- [x] **3.1** New context `src/agent-src/contexts/execution/subagent-response-contract.md`
      pinning the return shape: `summary / findings[] / evidence[] / risks[] /
      confidence(low|medium|high) / handoff`. Additive to the 4-status taxonomy
      (status stays the envelope; this is the body).
- [x] **3.2** Orchestrator synthesis duties (bind into `subagent-steering` +
      `verify-budget`): dedupe findings, mark contradictions, re-check
      missing/low-confidence evidence with a real tool, downgrade or reject risky
      findings — never adopt a subagent return unverified.
- [x] **3.3** Confidence → verify-budget link: `confidence: low` on a mutating
      finding forces the full cross-model judge path (no deterministic-only pass);
      `high` + trivial may take the deterministic path. Record the chosen
      `verify_mode` (already in telemetry).
- [x] **3.4** Validator `src/scripts/_lib/subagent_response.ts` — parse/validate
      an envelope, surface a structured "evidence gap" when a non-trivial finding
      lacks evidence. + tests.

## Deferred / rejected (council verdict — do not build here)

- **A4 — work_engine `/work` integration → separate ADR.** Council: **reject in
  current form.** Wiring auto-dispatch into the `/work` loop + `.work-state.json`
  couples a behavioural policy to the engine and raises schema / replay / rollback
  questions ADR-105 deliberately avoided. If pursued, it needs its own ADR
  defining state shape, replay semantics, rollback, and the cross-boundary guard —
  not a phase here.
- **A5 — `policy: cost|capacity|balanced` + `min_task_signal` knobs → rejected.**
  Council: settings-surface bloat without demonstrated demand; the shipped
  `auto` + `downshift` + `quota_arbitrage` already encapsulate the cost/capacity
  intent. Revisit only on real demand signal.

## Acceptance criteria

- A loadable delegation-policy rule (tier-2) is the single source of the
  auto-trigger; skill prose points at it; always-budget unchanged.
- The bundle resolver returns real role + knowledge-refs + tier from existing
  registries (judge-* lenses reused), ADR-100-safe, with an audit signature.
- The structured response envelope + synthesis duties are pinned and wired to the
  verify budget; low-confidence mutating findings force a full judge.
- A4 is recorded as deferred-to-ADR; A5 as rejected — neither half-built.
- All quality gates pass; `/condense` + projections regenerated; tier-space
  guard green (no vendor model names outside the generator).

## Council review (2026-06-23)

Deep council (design mode). **anthropic/claude-sonnet-4-5 unavailable** (CLI
transport `curl ETIMEDOUT`, both attempts) → this round is **openai/gpt-4o +
host critical-evaluation**. Recorded transparently rather than presented as a
two-member convergence.

### Findings (gpt-4o)

1. **A1 build** — a dedicated auto-trigger rule gives predictable, auditable
   firing vs. fragile prose activation.
2. **A2 build (minimal slice) — highest-leverage** — wire directly to the
   existing registries; realises the role/profile/knowledge binding with the
   least risk; the item that best implements the user's original goal.
3. **A3 build, scoped** — confidence-gated re-verify integrates into the existing
   verify budget; enhances synthesis without large structural change.
4. **A4 reject in current form → defer to a separate ADR** — coupling risk +
   undefined schema/replay/rollback impact; do not wire into work_engine now.
5. **A5 reject** — current features suffice; extra knobs are premature surface.
6. **Sequencing** — benchmark first (the deferred gate), then A1+A2, then A3
   post-benchmark; A4 to a future ADR; A5 rejected. Emphasised ADR-100 knowledge
   boundaries + explicit rollback/kill-switch for any complex integration.

### Host verdict (codebase-grounded)

| # | Finding | Verdict | Reason |
|---|---|---|---|
| A1 | dedicated rule | `accept` | matches the gap (no delegation-policy rule exists yet); Phase 1 keeps it tier-2 (not kernel) so the always-budget stays flat. |
| A2 | resolver to real registries | `accept` | `composeSpawnBrief` is verifiably abstract; `agents/roles/` + `src/agent-src/profiles/` + judge-* skills already exist to resolve from — highest-leverage confirmed. |
| A3 | response envelope | `accept-with-modification` | scoped to additive context + validator + verify-budget link; the 4-status taxonomy stays the envelope, findings are the body. |
| A4 | work_engine depth | `accept` (reject-here) | aligns with ADR-105 "activate, don't fragment"; recorded as deferred-to-ADR, not half-built. |
| A5 | policy knobs | `accept` (reject) | `downshift` + `quota_arbitrage` already cover the intent; no demand signal. |
| seq | benchmark first | `accept` | the v1 follow-up benchmark stays Phase 0; A1–A3 build on it, the default-on-fire stays gated on it. |

### Predecessor council trace

`agents/runtime/council/responses/auto-subagent-orchestration-v2.json` (this run).
