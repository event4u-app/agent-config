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
> A3 production-validator Gate-A eval is an honest null. `subagents.auto`
> defaults to `on` since ADR-117 (2026-07-09) — a bounded-downside flip,
> explicitly NOT a passed benchmark; `resolveShippedDefault()`/`gateVerdict()`
> is retained as the telemetry-driven demotion gate back to `ask`. This
> roadmap converts the standing null into a decision on the PUBLIC claim:
> prove a minimal orchestration win, or remove the surface from the public
> value proposition and keep it as an internal contract only.
> <!-- reconciled 2026-07-12 with ADR-117 via road-to-opt-portfolio-consolidation
>      Phase 1 (default was described as `ask` — stale since 2026-07-09). -->

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
  `subagents.auto` default = `on` since ADR-117 (2026-07-09,
  bounded-downside basis — not evidence of value; demotion gate to `ask`
  retained). The PUBLIC claim stays gated on real telemetry
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

- [x] Before collecting more data, write the single claim under test into
      `docs/CLAIMS.md` as `unbacked` (pre-registration — no moving the goalposts
      after the numbers land): e.g. "On the ordered-refactor + competitive-impl
      families (`orch-02`, `orch-03`), contract-governed dispatch nets ≥15%
      token-or-wall reduction at non-regressed quality vs single-agent."
      <!-- done 2026-07-11: `### claim: orchestration-dispatch-net-win` added to
      docs/CLAIMS.md § Unbacked inventory, status unbacked, not markered in prose
      (markering an unbacked claim fails check_claims — the binding must come
      first). -->
- [x] Define "held quality" deterministically: reuse `check_quality_regression.ts`
      thresholds so a token win that degrades output fails the claim.
      <!-- done 2026-07-11: baked into the claim's falsification criteria (1) —
      held quality scored by src/scripts/check_quality_regression.ts thresholds;
      a token/wall win below the regression threshold FAILS the claim. -->
- [x] Define the negative control: `pv-02-negative-control` must NOT trigger
      dispatch — a classifier that fires on everything is a cost leak, not a win.
      <!-- done 2026-07-11: baked into the claim's falsification criteria (2) —
      pv-02-negative-control must NOT trigger dispatch. -->

**Exit:** one pre-registered, deterministically-scored orchestration claim in
CLAIMS, `unbacked`.
**Rollback:** delete the ledger line.

## Phase 2 — Accumulate real telemetry (inherits parent followup)

- [ ] Run real delegable work with `subagents.enabled: true` under the
      post-ADR-117 default (`subagents.auto: on`) until
      `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥20 orchestration
      lines (parent followup Phase 1, Steps 1–3).
- [x] Measure `parallelizable:` classifier recall AND false-positive rate on the
      corpus (`orch-01..03`, `pv-01`, `pv-02`) — both matter; a leaky classifier
      loses on cost even when it wins on the true positives.
      <!-- done 2026-07-11: deterministic measurement via the regression test
      src/scripts/_lib/auto_dispatch.corpus.test.ts (8 tests, green). Recall 2/2
      on the v1-covered modes (orch-01 → do-in-parallel, orch-02 → do-in-steps);
      false-positive rate 0 (pv-02 negative control NOT dispatched). Scope gap
      recorded: orch-03 (do-competitively) + pv-01 (verdict) are outside
      classifyTask v1's two DispatchModes. NOTE: this is the deterministic half
      of Phase 2; the ≥20 real telemetry lines (line above) stay maintainer-run,
      so the Phase-2 exit is not yet fully met. -->

**Exit:** ≥20 real orchestration lines; classifier recall + FP rate recorded.
**Rollback:** none — measurement only.

## Phase 3 — Gate the claim: prove or drop

- [ ] Feed the accumulated real telemetry through `gateVerdict()` /
      `resolveShippedDefault()`. PROVE = the pre-registered claim clears its
      threshold at held quality AND the negative control stayed quiet.
- [ ] PROVE → mark the CLAIMS entry `backed` with a resolving pointer; the
      ADR-117 `on` default is thereby CONFIRMED for the proven family (the
      bounded-downside basis upgrades to evidence); update the flip verdict.
- [ ] DROP → record the renewed honest null; demote the default back to
      `ask` via ADR-117's retained demotion gate; **and** demote the
      orchestration surface from the public value proposition: README/site stop
      listing orchestration as a capability and instead state the honest stance —
      "contract exists, default off, value not established; we do not ship
      unproven orchestration." The contract stays internal.
      <!-- PREMISE-STALE in clause 1, MAINTAINER-OWNED in clause 2, checked
      2026-08-10. Clause 1: there is no `subagents.auto` left to demote to
      `ask` — road-to-always-on-orchestration Phase 1 deleted the key from the
      template, the schema and the production path, and orchestration now
      resolves from a host-capability probe with `emergency.orchestration_halt`
      as the only switch. "Demote the default" therefore names a mechanism the
      tree no longer has; re-cutting it is a scope decision. Clause 2 is a
      change to what the package publicly claims, i.e. decide-what-ships — the
      distinction an AI council drew for a sibling roadmap the same day
      (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-08-10, 2 rounds,
      convergent): an agent may decide whether criteria are met, never what
      ships. It also runs directly against a roadmap that has already shipped
      orchestration as always-on, so the two must be reconciled by a human
      before either is acted on. -->
      <!-- THE GATE WAS BYPASSED, NOT PASSED — recorded 2026-08-14 on an outside
      opinion (1 seat, anthropic/claude-sonnet-4-5, 2 rounds; the second seat
      failed to start, so this is a single-model judgement admitted on its
      checkable merit and NOT a convergence).

      The note above is accurate and stops one sentence short of the thing that
      matters. It records that clause 1 names a mechanism the tree no longer has.
      It does not record what happened to the *evidence gate* that clause was
      guarding, and the difference sets a precedent.

      This roadmap's Phase 3 committed to a gate: evidence first, then the
      default. A later roadmap (always-on orchestration, Phase 1) made the
      capability unconditional and deleted the switch **without ever evaluating
      that evidence**. So the honest record is not "the question became moot when
      the later decision superseded it" — it is:

        1. The later roadmap's structural decision STANDS. That is not reopened
           here, and this note is not an argument to reopen it.
        2. The evidence gate this roadmap committed to was **never passed**. It
           was never evaluated at all. Nothing in the later decision references
           or satisfies the criterion stated above.
        3. The telemetry exists and is uninterpretable (see the blocker below).
           The question is therefore **unanswered**, not answered-and-obsolete.

      Why the distinction is worth a paragraph: "superseded, therefore moot"
      licenses the next roadmap to walk past its own evidence gate by shipping
      something that makes the gate unreachable. "Superseded, gate never passed"
      licenses nothing — it leaves the debt visible and named. Two different
      claims, two different precedents, and only one of them is true here.

      Left open by this note, deliberately: whether a bypass of a
      previously-committed evidence gate should require an explicit written
      justification, or whether "the later decision wins" is sufficient
      governance on its own. That is a doctrine question about how this tree
      records superseded commitments; it is maintainer-owned and is not settled
      by recording one instance of it. -->

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
- The ADR-117 `on` default is confirmed or demoted only on real,
  family-scoped evidence; `ask` remains the demotion floor.
- If dropped, the public value proposition no longer implies orchestration; the
  contract survives internally, unadvertised.
- The negative control (`pv-02`) is part of the pass condition — a classifier
  that over-fires cannot pass on true positives alone.

## Blockers

### blocker: real-orchestration-usage
- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 2 (and thereby Phase 3's decision)
- **What to do:** the build work is done; only real delegable work produces the
  telemetry. Use the agent on genuinely parallel/ordered multi-file tasks under
  the post-ADR-117 default (`subagents.auto: on`), then check
  `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`. Resume at ≥20.

  **Measured 2026-08-10 — the literal condition is MET (99 orchestration lines
  in `2026-08.jsonl`) and Phase 3 is still not decidable.** The count moved
  because the `orchestration-record` `post_tool_use` concern now emits per
  dispatch; it did not move because usage habits changed. But all 99 lines
  carry `token_delta: 0` / `estimated` and `null` for `dispatch_tokens`,
  `first_pass_success`, `escalated` and `task_class`, which is correct at that
  layer for a **background** dispatch (the host attaches usage only to a sync
  completion) — so "at held quality" has no input and PROVE cannot be
  evaluated. The full field-level measurement and why this is a live-host probe
  rather than an emitter bug is recorded once, in the sibling's
  `telemetry-sample-size` blocker; this roadmap's Phase 2 inherits it per the
  Notes section there.

  Two consequences worth stating before anyone reads the cleared count as a
  green light. **(1)** Feeding today's telemetry through `gateVerdict()` yields
  a null-or-worse reading assembled from one July line, not a verdict — the
  aggregate currently reports a net of tokens *added* at a 1 % measured share.
  **(2)** The DROP branch below is premise-stale in its first clause and
  maintainer-owned in its second, so a DROP is not an agent-executable
  outcome either.

  **Correction (2026-08-17) — two of the numbers above have moved, and one of
  them falsifies the mechanism claim rather than just the count.** Re-measured
  against `2026-08.jsonl` at 368 lines / **367 orchestration** (July still holds
  1): `token_delta: 0` and provenance `estimated` remain **367/367**, and
  `first_pass_success`, `escalated`, `task_class` and `dispatch_mode` remain
  `null` **367/367** — so the "at held quality has no input" conclusion stands
  unchanged and PROVE is still not evaluable. What does **not** hold is the
  parenthetical reason: `dispatch_tokens` is **numeric on 40 of 367** (327 null),
  i.e. the sync completions the clause said we have none of are now landing, and
  `wall_clock_ms` is numeric on **367/367**. The absolute-cost side therefore
  exists; what is still missing is the counterfactual and the quality columns,
  which is a narrower gap than the prose above describes. `spawn_count ≥ 2` is
  still **0 of 367**, so the corpus has never produced a fan-out.
- **Recommendation:** **(agent-drafted 2026-08-18 — this entry predates the
  field; drafted from the roadmap's own text for the consolidated decision
  sheet, not from a maintainer decision.)** Run the payload probe FIRST and
  treat its answer as the decision, rather than accumulating more usage. The
  entry's own re-measurement is decisive on this: at 367 orchestration lines
  the quality columns are `null` 367/367 and `spawn_count ≥ 2` is 0 of 367, so
  more of the same telemetry cannot populate the columns PROVE needs. If no
  hook slot sees the task-completion payload, Phase 3's verdict is an **honest
  null** and this roadmap terminates on that finding instead of waiting; only
  if a slot does see it is the ≥ 20-populated-line window worth opening.
- **If you do nothing:** 6 steps wait on a window that the entry's own numbers
  suggest may never fill, and the roadmap keeps reading as resumable to every
  feasibility screen — the exact misreading the 2026-08-17 rewrite of the
  Resolved-when was written to stop. A blocker whose condition cannot be
  reached is a park or a null, not a wait.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**. The
  rendered default (run the payload probe FIRST, rather than accumulating more usage) is
  accepted as the ORDERING and is what batch A's rationale rests on: line count is
  already satisfied and no longer diagnostic. The probe itself is a named live-host
  task-completion observation, so Rule 3 in
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
  assigns it `B`, merged with `telemetry-sample-size` into ONE task-completion
  observability stub. Batch A carries the three-point check verbatim: original criterion
  for both entries, Phase 1 telemetry seeding / Phase 2 evaluation / Phase 3's dependent
  decision moved, re-entry producer the subagent-observability maintainer.
- **Resolved when:** a probe result records whether any hook slot sees the
  task-completion payload, and — if one does — the current-month audit log
  carries ≥ 20 orchestration lines whose **quality** columns are populated
  rather than `null`. **Rewritten 2026-08-17.** The bare line-count condition
  this field carried until today (*"the current-month audit log holds ≥20
  orchestration lines"*) was satisfied at 99 lines when it was written and
  stands at **367** now, while the blocker never stopped being open — a
  resolution test that is already met cannot resolve anything, and every
  feasibility screen that trusted it read this roadmap as resumable. The
  sibling `road-to-subagent-value-realization-followup` had the identical
  defect repaired on 2026-08-16; this one was missed in the same pass.
