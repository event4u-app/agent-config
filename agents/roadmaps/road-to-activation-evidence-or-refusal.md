---
complexity: structural
status: ready
---

# Road to activation evidence — produce the red baseline or refuse the resolver permanently

> Operator-stated problem (2026-07-31): *"Skills and rules do not always fire,
> and not correctly."* A source-level analysis against four public reference
> suites located the cause architecturally: this package compiles activation
> declarations and never evaluates them at runtime. But this package has already
> **built, measured and torn down** a reminder-injection apparatus — Δ = 0 pp on
> both hosts, teardown pre-committed and executed, the third consecutive null in
> the same family. Its written revisit condition is a *produced* red-baseline
> corpus, not a claim. Council cut + verified repository state:
> [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md),
> prior verdict: [`reminder-injection-verdict`](../settings/contexts/reminder-injection-verdict.md).

## Goal

Decide the activation question with evidence instead of architecture. Produce the
red-baseline corpus the prior null's revisit condition demands — from session logs
that already exist on disk — and then either re-open the mechanism under the full
pre-registered design, or **refuse it permanently and delete the standing design
document**. This roadmap contains **no resolver code**; its most likely outcome is
a deletion.

## Context (verified 2026-08-01, do not relitigate)

- `docs/contracts/rule-router.md:120`: **"no runtime resolver."** Activation is a
  projection-time artifact.
- No hook reads `dist/router.json`. `user_prompt_submit` runs
  `[chat-history, verify-before-complete, minimal-safe-diff]` — all state recorders.
- Trigger-match semantics live only in `router_telemetry.ts` and
  `trigger_coverage.ts` (offline). Nothing applies them to a live prompt.
- ADR-054 is `status: proposed`, ~2 months old, unimplemented.
- Prior null (settled by evidence): 12 live sessions, 2 scenarios × 3 arms
  (kernel-only · targeted · random-equal-length negative control) × 2 host tiers.
  **Strong host 6/6 comply, weak host 6/6 comply, all arms indistinguishable.**
  Single-turn probes, rule ~600 words back. Pre-committed <5 pp → teardown, executed.
- The pilot's shape is **not** the operator's shape: multi-turn, long session,
  ≥3K-token distance was never tested. This makes the revisit condition
  **eligible**, not satisfied.
- `agents/runtime/` already carries redacted chat-history JSONL — the corpus
  source exists; no new instrumentation is required to look.

> **Scope boundary.** This roadmap does not reopen the rejected enforcement-first
> architecture, does not resurrect thin projection (`eager-all` stays the default
> and the quality-floor decision stands), and does not reopen the rejected
> deferred/lazy rule-retrieval mechanism. It adds **no** runtime surface in any
> phase. Learned activation weights (confidence loops, instinct promotion) are not
> in scope at any point in this file.

## Phase 0 — Produce the corpus, or fail to

The whole roadmap is this phase. It is a search for a red baseline in data that
already exists.

- [x] Pre-register the search **before looking**: the bar is ≥ 5 sessions, ≥ 8
      turns each, each showing a kernel or tier-2 rule whose obligation was
      objectively violated at a turn where the rule was **manually verified as
      still in context**, with turn-by-turn token accounting proving ≥ 3K tokens
      of distance at the failure, and the host tier named.
      *Verify:* the registration commit predates the first analysis commit. Do not
      edit the bar after reading the data.
- [x] Sweep the existing redacted chat-history JSONL for candidate failures.
      Machine-checkable obligations only (a completion claim with no verification
      evidence recorded that turn; a diff touching files the stated task never
      named; a commit shape the policy forbids) — no judgement calls, so the
      finding cannot be argued into existence.
      *Verify:* candidate list committed under
      `agents/evidence/analysis/activation-red-baseline.md` with one row per
      candidate: session, turn, rule id, obligation, distance in tokens, host.
- [x] For each candidate, confirm the rule was actually in context at the failing
      turn. A rule that was **not projected** into that session is a
      scoping/projection defect and belongs to a different fix — record it
      separately and remove it from the activation corpus.
      *Verify:* every row is classified `in-context-and-violated`,
      `not-projected` (→ separate defect), or `rejected` with the reason.
- [x] Classify what remains by host tier. Failures confined to a host tier weaker
      than the pilot's weak host are already covered by the prior verdict's second
      revisit path and do **not** justify a resolver.
      *Verify:* per-tier counts stated in the report.

## Phase 1 — The verdict, both branches pre-written

- [ ] **Branch A — no red baseline found** (the expected outcome): record it in the
      report as a fourth null-adjacent finding, move ADR-054 to `rejected` citing
      this attempt, and decide the offline matcher's fate in the same pass — either
      it keeps earning its place as a CI coverage floor (`trigger_coverage`) or it
      goes with the ADR. **D1 is then refused permanently**; a later re-open needs
      a materially weaker host tier entering the consumer set, or an explicitly
      funded full n≈50/arm run.
      *Verify:* ADR-054 status changed, the refusal recorded in
      [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md),
      and no resolver code exists anywhere in the tree.
- [ ] **Branch B — red baseline found**: the question re-opens, and the *cheapest*
      candidates are tried first, in this order — the runtime resolver is last,
      not first.
      1. **Written-down state.** The obligation is written into a project-visible
         file the agent reads with existing filesystem tools; no hook, no
         injection, no new concern. (This is how the zero-hook reference suite
         solves "the agent forgot".)
      2. **Generated file→skill table** in the projected root instruction files,
         derived from the router's path-shaped triggers, regenerated by the
         existing build step so it cannot drift. Static text, no host support
         needed, ~12 rows at consumer scope after collapsing multi-row rules and
         filtering maintainer-only scope. Rows are filtered through the same scope
         predicate the rule projection uses — a consumer must never be taught
         maintainer paths.
      3. **Stop-event consumer** for the already-recorded verification state (the
         state file is written today and nothing reads it) — warn, never block.
      4. Only if 1–3 measurably fail on the *same corpus*: the prompt-time
         resolver, under the full pre-registered n≈50/arm design, default-OFF,
         one-line pointers only, kernel roster on decay milestones and never
         per-turn.
      *Verify:* each candidate is measured against the Phase-0 corpus before the
      next one is built; the first that closes the gap ends the branch.
- [ ] Either branch: publish the outcome where the other nulls live, so the family
      count stays honest.
      *Verify:* the entry names the shape tested and the shape not tested.

## Non-goals (recorded refusals)

- **No fact-forcing gate.** Blocking the first Edit/Write per file until
  investigation facts are presented is enforcement-first architecture behind a
  settings knob; the locked refusal applies. Two sibling blocking gates already
  shipping is debt, not precedent.
- **No `intent:` implementation.** The dead trigger type is *removed*, not built
  — done by [`road-to-dead-surface-removal`](archive/road-to-dead-surface-removal.md)
  (2026-08-02: 106 declarations across 44 rules deleted; the schema now rejects
  the key).
- **No learned activation** (confidence loops, instinct promotion). Both reference
  implementations ship the loop with zero published evaluation of the loop itself.
- **No adoption-conditioned work.** Two of the four source documents make an
  external-adoption deadline their top phase; the operator ruled external adoption
  out of scope, so those phases are dropped wholesale rather than deferred.

## Surface delta

Phase 0 + Branch A: **−1 ADR, possibly −2 offline scripts, +1 evidence report.**
Net negative. Branch B adds surface only after the corpus proves a gap, cheapest
mechanism first.

## Provenance

Source: `agents/tmp.old/skill-rule-routing.txt` (operator-owned; source-level
comparison against four public reference suites plus a pre-drafted roadmap, which
this file deliberately restructures rather than adopts — the draft's Phase 0 tested
*mechanism feasibility*, while the prior null makes *whether a gap exists at all*
the first question). Disposition: council 2026-08-01
(`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, 2 rounds, $0.14) —
[`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).
Repository claims re-verified against the working tree on 2026-08-01, not taken
from the source document.
