---
complexity: structural
status: ready
parent_roadmap: road-to-subagent-value-realization-followup
---

# Road to orchestration scope decision — one falsifiable minimal claim, or an honest exit from the front

> **Standalone by council decision** (claude-sonnet-4-5 + gpt-4o, 2026-07-08,
> 2 rounds — converged in round 2): this is an ADOPTION claim requiring a
> public falsifiability gate, categorically distinct from the parent's
> internal telemetry work; merging would bury the prove-or-drop decision in
> someone else's Phase 3. Dependency on the parent's telemetry is stated in
> Phase 2's prerequisites, not resolved by merger. Phases 1 (pre-registration)
> and 4 (positioning draft) can run before/parallel to the telemetry blocker.
>
> Decide, on evidence, whether agent-config competes on orchestration at all —
> and if so, on exactly one narrow, measured claim rather than a swarm feature
> race. The subagent-v1 contract (ADR-109) and telemetry path are built; the
> A3 production-validator Gate-A eval is an honest null; `subagents.auto`
> stays `ask`. This roadmap converts that standing null into a decision:
> prove a minimal orchestration win, or remove the surface from the public
> value proposition and keep it as an internal contract only.

## Goal

Ship a single, falsifiable orchestration claim ("on delegable task family X,
contract-governed parallel dispatch nets a token-or-time win at held quality")
backed by real telemetry — or record the renewed null and explicitly scope
agent-config OUT of the orchestration front, positioning minimalism as a stance,
not an unfinished swarm.

## Context (measured, do not relitigate)

- Contract + plumbing exist: ADR-109 subagent-v1 contract,
  `subagent-spawn-contract` / `subagent-response-contract`, native projection to
  `.claude/agents/`, `subagent-orchestration` skill, delegation gates
  (failure-type stop + ordered-slice dependency), `readOrchestrationMetrics`,
  `/cost:report` orchestration summary, `gateVerdict()` in
  `src/scripts/_lib/orchestration_gate.ts`.
- Standing evidence: A3 production-validator Gate-A eval = honest null;
  `subagents.auto` default = `ask`; the flip is gated on real telemetry
  (`agents/settings/contexts/orchestration-default-flip-verdict.md`).
- The blocker is structural, not code: real orchestrated dispatches cannot be
  produced by a headless harness — they need real usage (parent followup
  `blocker: telemetry-sample-size`, ≥20 audit lines/month).
- Category reality (publicly observable, no counter-claim): the swarm category
  ships maximal orchestration — 100+ agent types, background daemon, memory DB,
  federation, "SOTA-vs-framework" matrices with no reproducible methodology.
  agent-config's differentiator, if it stays on this front at all, is the
  inverse: a minimal, contract-governed, evidence-gated dispatch — value proven
  before default-on, not asserted.

## Prerequisites

- [x] Telemetry-capture path + aggregator + bench arms built (parent).
- [x] Honest-null recorded; `ask` is the safe default.
- [ ] ≥20 real orchestration audit lines (parent followup Phase 1).

## Phase 1 — Pre-commit the falsifiable minimal claim

- [ ] Before collecting more data, write the single claim under test into
      `docs/CLAIMS.md` as `unbacked` (pre-registration — no moving the goalposts
      after the numbers land): e.g. "On the ordered-refactor + competitive-impl
      families (`orch-02`, `orch-03`), contract-governed dispatch nets ≥15%
      token-or-wall reduction at non-regressed quality vs single-agent."
- [ ] Define "held quality" deterministically: reuse `check_quality_regression.ts`
      thresholds so a token win that degrades output fails the claim.
- [ ] Define the negative control: `pv-02-negative-control` must NOT trigger
      dispatch — a classifier that fires on everything is a cost leak, not a win.

**Exit:** one pre-registered, deterministically-scored orchestration claim in
CLAIMS, `unbacked`.
**Rollback:** delete the ledger line.

## Phase 2 — Accumulate real telemetry (inherits parent followup)

- [ ] Run real delegable work with `subagents.enabled: true`,
      `subagents.auto: ask` until `agents/runtime/state/audit/YYYY-MM.jsonl`
      carries ≥20 orchestration lines (parent followup Phase 1, Steps 1–3).
- [ ] Measure `parallelizable:` classifier recall AND false-positive rate on the
      corpus (`orch-01..03`, `pv-01`, `pv-02`) — both matter; a leaky classifier
      loses on cost even when it wins on the true positives.

**Exit:** ≥20 real orchestration lines; classifier recall + FP rate recorded.
**Rollback:** none — measurement only.

## Phase 3 — Gate the claim: prove or drop

- [ ] Feed the accumulated `ask`-mode telemetry through `gateVerdict()` /
      `resolveShippedDefault()`. PROVE = the pre-registered claim clears its
      threshold at held quality AND the negative control stayed quiet.
- [ ] PROVE → mark the CLAIMS entry `backed` with a resolving pointer; propose
      `subagents.auto: ask → on` for the proven family only (scoped, not global);
      update the flip verdict.
- [ ] DROP → record the renewed honest null; keep `ask`; **and** demote the
      orchestration surface from the public value proposition: README/site stop
      listing orchestration as a capability and instead state the honest stance —
      "contract exists, default off, value not established; we do not ship
      unproven orchestration." The contract stays internal.

**Exit:** a `backed` scoped claim + scoped flip, OR a recorded null + a public
demotion of the front. No middle state where marketing implies a swarm the
evidence doesn't support.
**Rollback:** revert to `ask` (safe default) on any regression.

## Phase 4 — Position the minimalism (only after Phase 3 resolves)

- [ ] Write `docs/orchestration-stance.md`: whichever way Phase 3 went, state
      the category contrast honestly — agent-config offers evidence-gated
      minimal dispatch (or none), explicitly not a swarm platform; each claim
      binds to a resolvable pointer, the category is described only by what is
      publicly observable, never a named competitor.
- [ ] Add the `docs/proof.md` § 4 row: "orchestration value is measured before
      default-on (or absent), not asserted."

**Exit:** the stance doc exists and is CI-drift-checked like the rest of the
proof surface.
**Rollback:** none — positioning only.

## Acceptance criteria

- Exactly one orchestration claim is pre-registered, deterministically scored,
  and resolved to `backed` or honest-null — never left ambiguous.
- The `subagents.auto` default moves only on proven, family-scoped evidence;
  `ask` remains the floor.
- If dropped, the public value proposition no longer implies orchestration; the
  contract survives internally, unadvertised.
- The negative control (`pv-02`) is part of the pass condition — a classifier
  that over-fires cannot pass on true positives alone.

## Blockers

### blocker: real-orchestration-usage
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 2 (and thereby Phase 3's decision)
- **What to do:** the build work is done; only real delegable work produces the
  telemetry. Use the agent on genuinely parallel/ordered multi-file tasks with
  `subagents.auto: ask`, then check
  `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`. Resume at ≥20.
- **Resolved when:** the current-month audit log holds ≥20 orchestration lines.
