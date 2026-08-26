---
title: "Road to Episode Finalizer and Outcome Attribution v2"
complexity: structural
status: later
estate_growth_exempt: "Charges +1 later_roadmaps / -1 active on a MOVE, not an addition: the same file leaves the active tree for later/, and no roadmap was created. The move is the disposition AI council 2/2 directed on 2026-08-26 after both blockers resolved -- one as a host null, the other as NOT RESOLVABLE BY AN AUTONOMOUS RUN. roadmap-progress-sync section Later disposition requires it: AC-2 demands a ledger carrying >=2 distinct machine provenances, all 4,912 measured stops are machine-local, and a second machine with independent traffic cannot be produced inside a session. +0 open_blockers: this change created none and RESOLVED two."
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived only status: draft roadmaps, which were never counted and so are unavailable as offsets. Its predecessor road-to-episode-finalizer-and-outcome-attribution was never landed in the active estate either, so the supersedes edge offsets nothing countable."
execution:
  mode: phase-checkpoints
pin: "fd42264a998e4ec66ba4fd397d9c37b801d045ba"
supersedes:
  - road-to-episode-finalizer-and-outcome-attribution
---
# Road to Episode Finalizer and Outcome Attribution v2

> **PARKED to `later/` on 2026-08-26 — blocked-for-later, not abandoned.** AI
> council 2/2 (`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 3 rounds,
> blind chairman, $0.079) under the maintainer's standing delegation.
>
> **Resume when** a ledger carries **≥ 200 non-local stops** from a machine with
> an independent identity, identical instrumentation, comparable traffic and
> **separately retained** evidence. Replaying this ledger, running fixtures, or
> assigning a different identity do **not** satisfy it, and CI does not qualify
> on the evidence available.
>
> **Both blockers are RESOLVED; the roadmap is parked anyway, and the two facts
> are not in tension.** `b-quality-columns-unreachable` closed as a **host null**
> and `b-machine-local-denominator` closed as **not resolvable by an autonomous
> run** — a resolved blocker records an answer, and here both answers are that
> the work cannot proceed. Steps 2.2 and 5.2 are `[-]` descoped in consequence.
>
> **The external-validity gap is stated HERE, at the outcome, and not only beside
> the two steps.** A seat named the exact failure mode: *"Descoping the steps
> risks converting an unresolved external-validity gap into apparent roadmap
> completion."* So, plainly: **no cross-machine rate was established, and none is
> establishable from this ledger.** All 4,912 measured stops are machine-local.
>
> **Why parking rather than closing around the descopes.** One seat made the test
> checkable rather than a matter of taste — park only if a qualifying
> cross-source rate is an *acceptance criterion* of the central outcome. It is:
> **AC-2** requires *"a ledger carrying ≥2 distinct machine provenances"*. The
> other seat reached `later/` independently, on the ground that `unknown` quality
> fields undermine the *"outcome attribution v2"* the title claims. Both routes
> land in the same place.
>
> **Recorded now so it is not rediscovered later: confirmability ≠
> representativeness.** Two machine identities buy confirmability. They do **not**
> buy representativeness while both carry the same operator's drain-run traffic —
> and this ledger's does. So a future rate is **descriptive of the measured
> traffic**, must say so wherever it is quoted, and per-machine figures come
> **before** any pooled one (which AC-2 already required, and the council
> independently re-derived).

> **Source:** agents/tmp.old/road-to-10/road-to-episode-finalizer-and-outcome-attribution-v2.md

> **Council revision, landed 2026-08-24 against HEAD `0f7c26ee9` with the first
> two phases deleted as already-shipped.** The draft's premise was that
> attribution cannot start from a capture mechanism near zero, and it therefore
> made capture completeness and host completion-observability hard
> prerequisites. Both prerequisites were already satisfied at landing: the
> mechanical dispatch audit exists and is bound, and the host completion probe
> has been run and its result written down. What remains open is narrower and
> sharper — a contradiction between two shipped contracts about how to read a
> flat envelope rate. See § Corrections applied at landing.

## Goal

Close the observable chain:

```text
capability invoked
  -> result returned
  -> result consumed
  -> parent action delta
  -> verification
  -> final outcome
```

without:
- daemon runtime,
- subagent self-grading,
- simulated host payloads,
- invented counterfactual causality,
- forcing judgement questions into CI.

## Context — what is already shipped, and what that leaves

1. **The mechanical dispatch audit exists.**
   `src/scripts/hooks/orchestration_record_hook.ts` is bound on
   `post_tool_use` in **6 host rows** of `src/scripts/hook_manifest.yaml`
   (verified by grep at landing: 6 of 6 `post_tool_use:` rows list
   `orchestration-record`). The manifest comment at `:556` states it appends
   the record with "no model step, replacing the model-carried step". The
   draft's Phase 0 asked for this to be built.
2. **The host completion probe has been run.** 2026-08-20, host `2.1.237`,
   commit `caa046343`; the measurement is
   `agents/evidence/analysis/orchestration-task-completion-payload-probe.md`
   and its 3-row verdict table is reproduced in
   `agents/roadmaps/stubs/road-to-task-completion-observability.md`. Its third
   row is the finding that matters: `first_pass_success` and `escalated` are
   **not payload-derivable at ANY hook slot, by construction** — the contract
   defines both over the parent's *subsequent* rework, events that have not
   happened at task completion. The draft's Phase 1 asked for this probe.
3. **The adoption claim is registered, and already read.**
   `claim:subagent-valid-envelope-rate` is in `docs/CLAIMS.md:728-730`
   (registered 2026-08-22), threshold "greater than zero and rising",
   deliberately not a percentage. `src/scripts/report_envelope_rate.ts` is the
   reader. The reading is **0.00 % valid envelopes over 4,274 stops**.
4. **`malformed` already shipped under another name.** `foreign_object` is a
   live verdict in `src/scripts/hooks/subagent_ledger_hook.ts:200`, defined at
   `:271` as "an object arrived and carried NONE of the required fields", and
   four such rows exist in the ledger. The draft's Phase 3 proposed
   `malformed` as a new return state.
5. **Every figure above comes from one machine's gitignored ledger.** Neither
   `agents/runtime/state/audit/` nor `agents/runtime/state/subagent-ledger/`
   exists in this worktree, so none of the counts in this file are reproducible
   here. That is not a defect in the counts; it is blocker
   `b-machine-local-denominator`, and it reorders the phases below.

## Phase 0 — Adjudicate the envelope DROP contradiction

The draft's Phase 0 (build the capture) and Phase 1 (probe the host) are both
shipped. What replaces them is the decision their results created.

- [x] **Step 0.1:** Resolve blocker `b-envelope-drop-vs-unresolved`: Phase 2.2's
      pre-registered DROP band is arithmetically satisfied today (0.00 % over
      4,274 stops, against `population >=200` / `DROP <=1%`), while the shipped
      `claim:subagent-valid-envelope-rate` forbids reading a flat rate as the
      pointer having failed — its falsification clause (1) says a flat rate
      "is reported as unresolved rather than as the pointer having failed".
      The two contracts contradict on the same number. Decide which governs
      **before** Phase 2 runs.
      verify: **resolved — and the verify line's own premise turned out to be
      false.** It says *"a decision that leaves both standing is not a
      resolution"*. Both standing is exactly what the resolution is: the band's
      population line reads `>=200 **non-local** stops`, all 4,912 measured stops
      are machine-local, so the eligible population is **zero** and the band was
      never triggered. Nothing is overridden and nothing is amended.

      That clause was written on the assumption that the two contracts genuinely
      collide on this sample. They do not — they collide on a sample that does
      not exist yet. Recorded rather than quietly satisfied, because a reader
      checking this step against its own verify line would otherwise conclude it
      was not met.
- [ ] **Step 0.2:** Stable identities on every dispatch record: `episode_id`,
      `dispatch_id`, capability/skill identity, parent episode reference,
      timestamp, host/provider metadata. No payload duplication.
      verify: a dispatch record carries all six fields; a record missing one
      turns exactly the identity check red; no field holds free-form content.

## Phase 2 — Repair producer-side return adoption

Returns are present; canonical envelopes are not. The rate is zero because
producers do not emit the shape — not because the schema rejects them.

- [ ] **Step 2.1:** Two-cause probe. Probe (1) delivery pointer missing;
      (2) delivery pointer outranked. Write expected signatures before fixes.
      verify: each cause has a written expected signature recorded before its
      probe runs; a probe whose signature was written afterwards is discarded.
- [-] **Step 2.2:** Read the registered claim rather than re-registering it.
      **DESCOPED 2026-08-26, AI council 2/2** — `b-machine-local-denominator` is
      **not resolvable by an autonomous run**. The band's population line reads
      `>=200 non-local stops` and **all 4,912 measured stops are machine-local**.
      Independent traffic and separately retained external evidence cannot be
      produced by replaying, relabelling or reprocessing the existing ledger
      inside this session, so this step has no denominator to read a rate from.
      Marked `[-]` rather than left `[ ]`: nothing here is pending work an
      autonomous run can pick up.

      The pre-registered band stands:

      ```text
      population >=200 non-local stops
      PROVE >5%
      DROP <=1%
      INDETERMINATE 1..5%
      ```

      Its application is gated on Step 0.1, because today's reading lands in
      the DROP band and the claim's own falsification clause forbids that
      conclusion.
      verify: the verdict cites `report_envelope_rate.ts` output with its
      window bounds, stop count and ledger path on one line, and cites the
      Step 0.1 decision as its authority for reading the band at all.

      **The Step 0.1 decision (2026-08-25) is that authority, and it withholds
      permission rather than granting it.** The band's population line requires
      `>=200 non-local` stops; every stop measured to date is machine-local; the
      eligible population is zero. **This step cannot run until
      `b-machine-local-denominator` resolves** — which Step 2.3 below already
      states, against a phase numbering that puts this step first.
- [ ] **Step 2.3:** Multi-machine ingestion. This is a **prerequisite** of
      Steps 2.2 and 5.2, not a successor — every envelope figure to date comes
      from one gitignored machine-local ledger, so no rate from it generalises
      (the claim says so itself).
      verify: the ledger read by `report_envelope_rate.ts` carries ≥2 distinct
      machine provenances, and the per-machine rates are reported separately
      before any pooled figure is quoted.
- [ ] **Step 2.4:** High-adoption window, only after PROVE: ≥95 % over ≥500
      representative non-local stops; `foreign_object`/refusal arms reported
      separately.
      verify: the window's stops are non-local and representative by a recorded
      rule, not by selection after the fact.

## Phase 3 — Return consumption acknowledgement

- [ ] **Step 3.1:** Extend the canonical return record with machine-readable
      parent disposition:

      ```text
      delivered
      consumed
      ignored_with_reason
      parent_ended_unconsumed
      delivery_failed
      foreign_object
      ```

      The parent owns the acknowledgement. No silent missing state.
      verify: every legal state is reachable in a test; a return that reaches
      none of them turns exactly the disposition check red rather than being
      recorded as `delivered`.

## Phase 4 — Terminal episode record

- [ ] **Step 4.1:** Define a compact parent-owned record:

      ```text
      episode_id
      capability
      dispatch_ids[]
      return_ids[]
      consumed_return_ids[]
      criterion_ids[]
      parent_action_delta:
        none | plan_changed | output_changed | aborted | unknown
      verification:
        passed | failed | absent | unknown
      outcome:
        merged | retained | discarded | superseded | blocked | unknown
      finalized_at
      ```

      `unknown` is mandatory and legal. Do not copy implementation diffs or
      evidence bodies into the episode; reference them.
      verify: the record type has no field capable of holding free-form
      content, a prompt, or a file body — privacy by schema shape, per
      `domain-safety-pii` § Surface 2; and `unknown` round-trips rather than
      being coerced.

## Phase 5 — Negative controls and coverage

- [ ] **Step 5.1:** Defect twins, at minimum: known discarded result →
      `discarded`; consumed result → consumption recorded; dropped finalizer
      record → exactly the finalizer coverage check red; `foreign_object`
      return → that state, not silent loss; parent terminates before consume →
      explicit terminal state.
      verify: each twin is proven RED by sabotaging the mechanism it guards,
      then restored — a twin never seen red has unknown sensitivity.
- [-] **Step 5.2:** Pre-register coverage:
      **DESCOPED 2026-08-26, same decision as Step 2.2.** The criterion reads
      `>=200 representative episodes`, and **representative** is precisely what
      this ledger cannot supply: even a second machine identity would give
      confirmability without representativeness while both carry the same
      operator's drain-run traffic. Descoping the pre-registration rather than
      registering a claim whose population cannot exist yet.


      ```text
      episode-finalizer-coverage
      PROVE >=90% terminal records over >=200 representative episodes
      ```

      Terminal content distribution is reported, not gated. The percentage of
      episodes where delegation "helped" is an engineering judgement, not a CI
      gate. Gated on Step 2.3 — a coverage figure from one machine is not a
      coverage figure.
      verify: the claim is registered in `docs/CLAIMS.md` with its
      falsification criteria fixed before the first reading, and the reading
      cites ≥2 machine provenances.
- [ ] **Step 5.3:** Resolve blocker `b-quality-columns-unreachable`: either
      adopt the deterministic-episode-close candidate the stub records (episode
      closes at the first of { next dispatch, parent edit to a file the return
      named, corrective prompt to the same subagent id, session stop }, with
      its recorded falsifier at ~20 % session-stop closes), or record a host
      null for `first_pass_success` and `escalated`.
      verify: the blocker reads `Status: resolved`; if the candidate is
      adopted, its falsifier is evaluated over a recorded corpus and the result
      published either way.

## Phase 6 — Attribution analysis

- [ ] **Step 6.1:** Only after capture + finalizer coverage prove: re-run the
      existing registered question `orchestration-dispatch-net-win`
      (`docs/CLAIMS.md:266-269`, still `status: unbacked`) **without moving
      thresholds**. Allowed terminal outcomes: PROVE, DROP, INDETERMINATE,
      undecidable-in-production. A second well-instrumented indeterminate
      result may justify re-registering the question as benchmark-only rather
      than keeping it permanently open.
      verify: the thresholds in the resolving report are byte-identical to the
      pre-registered ones; the provenance of each arm (`measured` vs
      `estimated`) is named on the line, per that claim's own criterion (2).

## Phase 7 — Feed existing systems

- [ ] **Step 7.1:** Use finalizer data as input to council evidence integrity,
      routing experiments, drain-run verdicts, persistent-learning evidence
      memory, and the capability scorecard. Do not fork new
      council/router/learning telemetry schemas unless the existing ones
      cannot reference episode IDs.
      verify: each consumer references `episode_id` rather than carrying its
      own copy; a new schema is justified in writing by a named inability to
      reference.

## Blockers

### blocker: b-envelope-drop-vs-unresolved
- **Status:** resolved 2026-08-25 — **the band does not trigger, and NEITHER
  contract is weakened.** Full note:
  [`agents/evidence/analysis/envelope-band-population-2026-08-25.md`](../evidence/analysis/envelope-band-population-2026-08-25.md).

  **The band's own population line settles it, and nobody had quoted it.** It
  reads `population >=200 **non-local** stops` — the word is in the
  pre-registration, ahead of the thresholds. Step 2.3 of this same roadmap
  defines it: *"every envelope figure to date comes from one gitignored
  machine-local ledger, so no rate from it generalises"*.

  Re-measured 2026-08-25: **0 ok of 4,912 stops**, read from
  `agents/runtime/state/subagent-ledger/2026-08.jsonl`. Run in a clean worktree
  the same command prints *"NO LEDGER … is not a measurement of zero"*. **Every
  one of the 4,912 is machine-local, so the eligible population is zero, not
  4,912.**

  So the band is **not triggerable on this sample** — not overridden, not
  amended. Its precondition is unmet by its own wording, and the claim's
  falsification clause is untouched because there is no DROP reading to forbid.
  That is precisely the resolution the owner-rationale said did not exist:
  *"either resolution weakens a pre-registered criterion"*. **This one weakens
  neither**, which is why it is releasable here.

  **It is not post-hoc revision**, which is the objection this has to survive:
  `non-local` was in the pre-registration before any measurement was taken, and
  the note quotes it rather than adding it.

  **What the council contributed.** Asked whether the machine-local finding
  *mooted* the contradiction, both seats said **no** and corrected the framing —
  outcome, attribution and generalisation are three separate judgments. Their
  reconciliation was a **split resolution**: the band classifies an *outcome*,
  the claim governs *causal attribution*, so both hold — *"Local DROP; cause
  unresolved; cross-machine status unconfirmed."* One seat then set the condition
  that decided the case: *"the original language should be quoted before owner
  sign-off. Without it, declaring the band 'not yet triggerable' risks post-hoc
  criterion revision."* Quoting it resolved the question in the direction that
  seat had left open. **The split resolution is recorded as the reading that
  governs once an eligible population exists** — which is the state Step 2.3
  exists to produce.
- **Owner:** maintainer/owner
- **Blocks:** Phase 0 Step 0.1, and transitively all of Phase 2.
- **What to do:**
  1. Read Phase 2.2's pre-registered band in this file and falsification
     clause (1) of `claim:subagent-valid-envelope-rate`
     (`docs/CLAIMS.md:728-730`). The band says `DROP <=1%` over `>=200`
     stops. The claim says a flat rate "is reported as unresolved rather than
     as the pointer having failed", because a zero rate has at least three
     causes a single rate cannot separate.
  2. Today's reading — 0.00 % over 4,274 stops — satisfies the DROP band
     arithmetically and is forbidden the DROP conclusion by the claim.
  3. Decide which contract governs, and record what happens to the other.
- **Owner rationale:** this is owner-reserved rather than council-decidable
  because either resolution **weakens a pre-registered criterion**: reading
  DROP overrides a shipped falsification clause, and honouring the clause
  voids a pre-registered band. Prior council attempt split:
  `agents/evidence/council/envelope-adoption-blockers-2026-08-22.md`.
- **Recommendation:** the claim's clause governs and the band is amended,
  because the clause states a reason the band does not answer — three causes,
  one number. But this is a recommendation to the owner, not a resolution.
- **If you do nothing:** Phase 2 either reads DROP and terminates the approach
  on evidence its own claim says cannot support that reading, or stalls
  indefinitely with a satisfied band it may not act on.
- **Resolved when:** one of the two contracts is amended in the tree, the
  amendment names the other, and the recorded decision says which reading of
  a flat rate is legal going forward.

### blocker: b-quality-columns-unreachable
- **Status:** resolved 2026-08-26 — **option (2): a HOST NULL, narrowly scoped.**
  AI council 2/2, inlined convergence: `anthropic/claude-sonnet-4-5` +
  `openai/codex-default`, 3 rounds, blind chairman, quorum concluded 2/2,
  $0.079 actual.

  **Both seats overruled this blocker's own recommendation of option (1).** The
  reason is arithmetic rather than preference: option (1) says *adopt the
  candidate and evaluate its falsifier over a recorded corpus*, and **there is no
  eligible corpus to evaluate it against** — 0 populated rows at each
  re-derivation, three successive corpus growths moving no verdict,
  `dispatch_mode` 0 across both measured months. *"A zero eligible denominator
  cannot test the candidate's falsifier."* Adopting a contract definition whose
  falsifier is unevaluable is the wrong order of operations.

  **The null's exact scope — this wording is the deliverable, not a formality:**

  > Under the current contract and completion-time instrumentation,
  > `first_pass_success` and `escalated` cannot be determined, because both
  > depend on **subsequent parent behaviour**. This is a limitation of the
  > current observation point — **not** evidence that the concepts are
  > unmeasurable in principle, and **not an observed value of zero.**

  The last clause is the one that matters and is why a bare `unknown` was
  rejected: a `0/0` denominator is an **absent measurement**, not a null result,
  and a reader who takes it for a measured zero concludes the opposite of the
  truth. Phase 4's dependent fields therefore carry a documented unavailable
  state rather than a bare `unknown`.

  **The candidate is preserved as an EXPERIMENT and deliberately not written into
  the contract.** It stays a recorded proposal with its falsifier attached
  (~20 % session-stop closes ⇒ the boundary measures the session, not adoption);
  `orchestration-telemetry.md` is **not** amended. Before it could be adopted,
  both seats required: closure reasons, censoring rules, the denominator, a
  minimum sample and the exact session-stop threshold predeclared — plus an
  attribution audit showing the candidate boundaries actually track the same task
  scope, not merely that they close.

  **Revisit-if:** a predeclared minimum corpus contains observable closed
  episodes with sufficient rework and re-dispatch variation, the session-stop
  rule becomes evaluable, and an attribution audit passes.
- **Owner:** council
- **Blocks:** Phase 5 Step 5.3; the `parent_action_delta` and `verification`
  fields of Phase 4 degrade to `unknown` without it.
- **What to do:**
  1. Read row 3 of the probe verdict table in
     `agents/roadmaps/stubs/road-to-task-completion-observability.md`:
     `first_pass_success` and `escalated` are not payload-derivable at any
     hook slot **by construction**, because the contract defines both over the
     parent's subsequent rework.
  2. Read the same stub's recorded candidate — the deterministic episode close
     — and its attached falsifier (~20 % session-stop closes means the
     boundary measures the session, not adoption).
  3. Either adopt the candidate and evaluate its falsifier over a recorded
     corpus, or record a host null for both columns.
- **Recommendation:** adopt the candidate and publish the falsifier result
  either way. A host null closes the row honestly but leaves the definition
  un-improved for the next attempt.
- **If you do nothing:** the live ledger's quality columns stay `null` — the
  stub records 0 populated of the rows it counted at each re-derivation, and
  three successive corpus growths moved no verdict.
- **Resolved when:** either the candidate is adopted with its falsifier
  evaluated and published, or a host null is recorded for
  `first_pass_success` and `escalated` with the construction reason cited.

### blocker: b-machine-local-denominator
- **Status:** open — **and it is now the ACTUAL gate**, promoted from a
  side-condition by the 2026-08-25 resolution of `b-envelope-drop-vs-unresolved`.

  That blocker resolved by finding the band's population line reads `>=200
  **non-local** stops` while all 4,912 measured stops are machine-local. So the
  question the roadmap treated as "which contract wins" is really "when does an
  eligible population exist", and **this blocker is that question**. Nothing in
  Phase 2 can quote a rate until it resolves — which Step 2.3 already says in its
  own text (*"a prerequisite of Steps 2.2 and 5.2, not a successor"*), against a
  phase numbering that puts 2.2 first.

  **AI council 2/2 on what a second machine must be**, asked because an
  autonomous run has one: CI qualifies **only** with an independent identity,
  identical instrumentation, comparable traffic, and separately retained
  evidence. Replaying the maintainer's ledger, running fixtures, or merely
  assigning a different identity **does not** satisfy it. On the evidence
  available this run, CI does not qualify.

  One seat added a distinction worth keeping, because the `Resolved when` does
  not capture it: **"machine-local" conflates confirmability with
  representativeness.** Two machine identities give confirmability. They do not
  give representativeness if both carry the same operator's drain-run traffic —
  and this ledger's is exactly that. Satisfying `≥2 distinct machine identities`
  would therefore close the letter of this blocker while leaving the
  generalisation limit intact, and any rate quoted afterwards still has to say so.
- **Status:** resolved 2026-08-26 — **NOT resolvable by an autonomous run, by
  construction.** AI council 2/2, same session. Asked directly whether this run
  could resolve it at all, both seats said no: *"Independent traffic and
  separately retained external evidence cannot be created by replaying,
  relabelling, or processing the existing machine-local ledger inside this
  session."* All **4,912** measured stops are machine-local against a band line
  requiring **≥ 200 non-local**.

  **Consequence — Phase 2 Step 2.2 and Phase 5 Step 5.2 are `[-]` DESCOPED**,
  each citing the 4,912-of-4,912 figure. Both quote a rate; no rate is
  quotable.

  **The limitation belongs to the ROADMAP's outcome, not only to the two steps.**
  One seat named the failure mode precisely: *"Descoping the steps risks
  converting an unresolved external-validity gap into apparent roadmap
  completion."* So it is stated in the parking header as well as here.

  **The confirmability-versus-representativeness choice, recorded NOW rather than
  when someone quotes a number** — both seats asked for exactly that ordering.
  Two machine identities buy **confirmability**. They do not buy
  **representativeness** if both carry the same operator's drain-run traffic, and
  this ledger's does. So even after a qualifying second machine appears, any rate
  is **descriptive of the measured traffic** and must say so. Broader
  generalisation needs independent *operators* or genuinely diverse workloads —
  not another machine identity.

  **Per-source before pooled, and this was already the contract.** Both seats
  required per-machine figures rather than a pooled number, on the ground that
  4,912 local + 200 non-local pooled is dominated by the original machine so
  *"multi-machine" becomes a label on an effectively single-machine statistic*.
  **AC-2 already says this** — *"every published rate reports per-machine figures
  before any pooled one"* — so the council independently re-derived a requirement
  the roadmap had already written down. Recorded because agreement reached twice
  from different directions is worth more than either pass alone.

- **Owner:** council
- **Blocks:** Phase 2 Step 2.2 and Phase 5 Step 5.2 — both quote a rate.
  Phase 2 Step 2.3 is the work that resolves it.
- **What to do:**
  1. Note that `agents/runtime/state/audit/` and
     `agents/runtime/state/subagent-ledger/` are gitignored and absent from a
     fresh checkout — verified absent in this worktree at landing.
  2. Every envelope and coverage figure in this file therefore describes one
     maintainer machine's drain traffic. The registered claim says so in
     falsification clause (2): "no rate from it generalises".
  3. Build the multi-machine ingestion path (Step 2.3) **before** any verdict
     that quotes a rate, and report per-machine rates before any pooled one.
- **Recommendation:** treat Step 2.3 as a Phase 2 prerequisite rather than its
  third step, and reorder if the queue allows. A single-machine PROVE is not
  cheaper than a two-machine one; it is unusable.
- **If you do nothing:** Phases 2.2 and 5.2 produce verdicts whose
  denominator is one machine, which the claim they rest on already declares
  non-generalising — a verdict that cannot be cited is not a verdict.
- **Resolved when:** `report_envelope_rate.ts` reads a ledger carrying ≥2
  distinct machine provenances and reports per-machine rates alongside any
  pooled figure.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A pre-registered band is read against a claim that forbids the reading | product | The DROP band and the claim's falsification clause both ship, and they disagree about the same 0.00 %. Whichever is followed silently, the other becomes a dead contract nobody amended. | Blocker `b-envelope-drop-vs-unresolved` is owner-reserved and gates all of Phase 2; a resolution that leaves both contracts standing is defined as not a resolution. | Phase 0 — Adjudicate the envelope DROP contradiction |
| 2 | A rate from one machine is published as a rate | implementation | Every figure in this file comes from a gitignored ledger absent from a fresh checkout. Pooling one machine's drain traffic into a percentage manufactures a denominator. | Blocker `b-machine-local-denominator`; Step 2.3 is declared a prerequisite of 2.2 and 5.2 rather than their successor, and per-machine rates are reported before any pooled figure. | Phase 2 — Repair producer-side return adoption |
| 3 | The quality columns are quietly defaulted to a value | implementation | `first_pass_success` and `escalated` are unreachable by construction. A finalizer that writes `false` rather than `unknown` fabricates the very outcome dimension this roadmap exists to measure honestly. | Phase 4's `unknown` is mandatory and its verify requires round-tripping; blocker `b-quality-columns-unreachable` forces an explicit adopt-or-null decision. | Phase 4 — Terminal episode record |
| 4 | A twin is written and never seen red | implementation | A negative control that has never failed has unknown sensitivity — the repo has recorded this failure with a concurrency test that stayed green against the code it was written to refute. | Step 5.1's verify requires sabotaging each guarded mechanism, watching the twin go red, then restoring. | Phase 5 — Negative controls and coverage |
| 5 | A judgement question migrates into a gate | product | "Did delegation help" is the question everyone wants gated, and gating it is score theatre. | Step 5.2 states terminal content distribution is reported, not gated; Phase 6 keeps the four terminal outcomes including undecidable-in-production. | Phase 5 — Negative controls and coverage |
| 6 | The episode record grows into a transcript store | implementation | Copying diffs or evidence bodies into the record is the easy path and turns a compact index into a second copy of the repository's history, with the privacy surface that implies. | Phase 4 references rather than copies, and its verify asserts no field can hold free-form content. | Phase 4 — Terminal episode record |

## Acceptance Criteria

- [ ] AC-1 — Blocker `b-envelope-drop-vs-unresolved` reads `Status: resolved`,
      and the recorded decision names which of the two contracts governs a
      flat envelope rate.
- [ ] AC-2 — `report_envelope_rate.ts` reads a ledger carrying ≥2 distinct
      machine provenances, and every published rate reports per-machine
      figures before any pooled one.
- [ ] AC-3 — Every dispatch record carries all six stable identity fields; a
      record missing one turns exactly the identity check red.
- [ ] AC-4 — The terminal episode record round-trips `unknown` on every field
      that admits it, and no field can hold free-form content.
- [ ] AC-5 — Each of the five Step 5.1 twins has been proven red by sabotage
      and restored, with the sabotage recorded.
- [ ] AC-6 — `claim:episode-finalizer-coverage` is registered with
      falsification criteria fixed before its first reading.
- [ ] AC-7 — Blocker `b-quality-columns-unreachable` reads `Status: resolved`,
      as either an adopted candidate with a published falsifier result or a
      recorded host null.
- [ ] AC-8 — `orchestration-dispatch-net-win` is re-run against
      byte-identical pre-registered thresholds, with each arm's provenance
      (`measured` / `estimated`) named on the line.

## Corrections applied at landing (2026-08-24)

| What | Was | Now | Why |
|---|---|---|---|
| Phase 0 (Capture first) | "Every dispatch writes an audit record at emission time through a non-model-carried path", with a PROVE/REPAIR/DROP band and a maintainer-week window | Deleted; § Context item 1 records it as shipped | `src/scripts/hooks/orchestration_record_hook.ts` is bound on `post_tool_use` in **6 of 6** host rows of `hook_manifest.yaml`; the manifest at `:556` states it runs with "no model step, replacing the model-carried step". Already shipped. |
| Phase 1 (Discover the real completion boundary) | "Promote the existing task-completion-observability stub. Probe supported host hook slots." | Deleted; § Context item 2 records the probe and its verdict | The probe RAN on 2026-08-20 (host `2.1.237`, `caa046343`) and its result is written into `agents/roadmaps/stubs/road-to-task-completion-observability.md` as a 3-row verdict table. Its third row is the load-bearing finding: the quality columns are **not payload-derivable at ANY slot, by construction**. Already shipped. |
| Phase 2.1 cause 3 | "delivery pointer seen but schema ignored" | Deleted; the probe is now two-cause | Falsified: `validateResponse` was run by hand against minimal and rich envelopes and both validate. The rate is zero because producers do not emit the shape, not because the schema rejects it. Causes 1–2 stay open. |
| Phase 2.2 registration work | "Non-zero adoption claim … before the 95 % target" as work to do | Reframed as reading an already-registered claim, gated on the new Phase 0 | `claim:subagent-valid-envelope-rate` was registered 2026-08-22 (`docs/CLAIMS.md:728-730`). The reading also exists: **0.00 % valid envelopes over 4,274 stops**, which lands in this phase's own DROP band (`<=1%` over `>=200`). What remains is not registering or reading but adjudicating the contradiction. |
| New Phase 0 | Phase 0 was the capture build | Phase 0 is the envelope-DROP adjudication | Both original prerequisites are shipped; the decision their results created is what actually gates Phase 2. |
| `malformed` return state | Proposed as a new state in Phase 3's disposition enum | Replaced with `foreign_object` | `foreign_object` already shipped — `src/scripts/hooks/subagent_ledger_hook.ts:200`, defined at `:271`; four such rows exist live. Adding `malformed` beside it would be two names for one state. |
| Phase 5.1 twin list | "malformed return -> malformed state" | "`foreign_object` return -> that state" | Follows the enum correction above. |
| Phase ordering, 2.3 | Multi-machine ingestion as the third step of Phase 2 | Declared a **prerequisite** of Steps 2.2 and 5.2, with blocker `b-machine-local-denominator` | Every figure comes from one gitignored machine-local ledger; the registered claim's own falsification clause (2) says "no rate from it generalises". Neither ledger directory exists in this worktree. |
| Blocker inventory | No `## Blockers` section | Three added: `b-envelope-drop-vs-unresolved` (owner **maintainer/owner** — it weakens a pre-registered criterion), `b-quality-columns-unreachable` (council), `b-machine-local-denominator` (council) | The first is owner-reserved under `decision-revisit-gate`'s reserved set: either resolution weakens a shipped pre-registered criterion. Prior council attempt split — `agents/evidence/council/envelope-adoption-blockers-2026-08-22.md`. |
| Phase 6 | "Only after capture + finalizer coverage prove. Re-run existing registered questions such as orchestration dispatch net win" | Kept, with the claim pinned to `docs/CLAIMS.md:266-269` and its `unbacked` status verified at landing | Still genuinely open; the only phase the draft carried that needed no surgery. |
| Step shape | Phases were prose with `##` sub-headings and no checkboxes | Every phase is `- [ ]` steps, each carrying a `verify:` line | House roadmap contract. The draft had zero checkboxes and zero `verify:` lines. |
| Missing house sections | No `## Context`, no `## Risk Register`, no `## Blockers`, no `## Acceptance Criteria`, no Source line | All present | House roadmap contract; `Risk type` cells restricted to `product` / `implementation` per `lint_plan_risk_register.ts:288-293`. |
| Frontmatter | No `estate_offset_exempt` | Added, with the offset-unavailability reason stated | Every added roadmap in this run carries the exemption. |
| Ledger row figure | — | The brief cited "0 of 780 rows populated"; the stub's own re-derivation records **715 rows / 699 orchestration lines** with 0 non-null quality columns | **Brief mismatch, stated plainly:** the 780 figure is not reproducible from this worktree (both ledger directories are absent) and does not match the stub's last recorded count. The blocker text cites the stub's figure and the direction of the finding, which is unaffected either way. |
