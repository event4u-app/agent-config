---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Grows open_blockers 29 -> 30 and nothing else. Measured with check_estate_count on this change, not predicted: active_roadmaps 3 (floor 3, +0), later_roadmaps 75 (floor 75, +0), skill_count 299 (+0), skill_description_tokens 11455 (+0), concern_count 55 (+0). The active count is at its floor because this change archives road-to-governed-harness-evolution in the same commit — one in, one out, so no offset is claimed and none is needed. The single new blocker is metered-backend-park, and it is a blocker that ALREADY EXISTED as an unnamed constraint: the 5.2 evaluator-independence park of the archived roadmap held four obligations without ever appearing in the blocker count, so the +1 makes a standing constraint countable rather than adding a new one. The alternative is to write Phase 2 with no blocker, which would leave two steps looking workable while a recorded council decision forbids them - a silent block instead of a counted one."
---
# Road to governed evidence production

> **Source:** the terminal-disposition AI council of 2026-09-01, 2 of 2
> convergent (`anthropic/claude-sonnet-4-5` + `openai/codex-default`,
> subscription transport, nothing billed), recorded in full at
> `agents/evidence/analysis/governed-harness-terminal-disposition-question-2026-08-31.md`.
> That council was asked what to do with the four items that remained open on
> `road-to-governed-harness-evolution`, and it answered: none is closeable on
> existing evidence, no `verify:` clause may be retroactively re-scoped, no
> conjunction may close on its met half, and the disposition is a transfer to a
> receiver with an accountable owner. **This file is that receiver.** The owner
> accepted it and authorised the estate cost on 2026-09-01.

## Goal

The four evidence obligations the governed-harness programme could not
discharge are owned here, whole and unweakened, and each is either met against
the real mechanism or still visibly open — never closed on the half that was
already true. When this is finished, an activation receipt is produced by an
independent producer rather than inferred from a deterministic proxy, and a
proposer that costs money has been compared against the deterministic one in a
paired run rather than in an argument.

## Why the phases split where they do

Both seats named the same criterion, and it is a **trust boundary rather than a
convenience**: the 5.2 evaluator-independence park of the source roadmap forbids
a live model harness, so work that needs no metered call is executable now and
work that needs one is not. Phase 1 is the executable half. Phase 2 is blocked
by the `metered-backend-park` blocker below and stays open until an owner lifts
it.

**One deliberate deviation from the anthropic seat's illustrative list, named
rather than absorbed.** That seat placed the ordering-guard obligation (item 3's
pending conjunct) in the deterministic phase. By the criterion both seats
actually named, it belongs in Phase 2: `assertCheapestFirst` polices the order
in which *metered* proposer tiers are attempted, so a production caller for it
cannot exist while no metered call does. The criterion is followed here in
preference to the illustration, and the reader can see which was chosen.

## Phase 1 — Deterministic evidence, executable under the park

- [x] **1.1 Produce activation receipts from an independent, append-only
      producer, so the evaluation cascade's receipt-bearing stages have a
      subject.**
      Transferred whole from `road-to-governed-harness-evolution` step 4.1 —
      *"Cascade cheap to expensive, abort on the first hard failure."*
      verify: a candidate failing the cheapest stage consumes no model call, and
      the stage list can produce the Phase 1 classification.
      **Already discharged at transfer, reproduced so nothing is re-derived and
      nothing is re-credited.** `src/scripts/_lib/evaluation_cascade.ts` is a
      six-stage deterministic prefix (`schema-validity → path-ownership →
      holdout-disclosure → budget → near-duplicate → metric-verdict`) that
      aborts on the first hard failure; `model_calls` is the literal type `0` on
      every path, so the first conjunct follows from the type rather than from a
      counter. It is wired into the real runner (`evolution_lab.ts` `verbRun`)
      and was RED-proven on 2026-08-31 by letting the prefix assign
      `activation`, then by unwiring the cascade from the runner.
      **What is still open is the second conjunct.** The Phase 1 classification
      is the four-value `content | activation | adherence | unknown`, and the
      prefix may assign only `content` and `unknown` — `activation` and
      `adherence` are excluded by construction, because assigning either from a
      deterministic proxy manufactures evidence. The receipt SCHEMA exists and
      the CLASSIFIER exists; the PRODUCER does not, and nothing writes an
      `activation` object into an audit line.
      **Why this is Phase 1 and not Phase 2:** producing a receipt requires
      observing real activation, which the park does not forbid. It forbids a
      live model harness.
      **CLOSED 2026-09-01 — the producer exists, it writes, and the exclusion is
      gone.** Three artefacts, and each one names the gap it filled:
      (a) `src/scripts/_lib/activation_receipt_producer.ts` — the producer.
      `EVIDENCE_SOURCES` (`:65`) is a closed three-value set, each with a shipped
      observer; `buildActivationReceipt` (`:115`) refuses an unadmitted source
      and refuses an admitted source speaking about another source's rung;
      `appendActivationLine` (`:317`) uses `appendFileSync` and nothing else;
      `UNOBSERVED_RUNGS` (`:76`) makes the coverage gap enumerable data rather
      than prose. It imports no evaluation module, so TB-1 holds by construction
      rather than by care.
      (b) `src/scripts/activation_receipt.ts` — the PRODUCTION CALLER, because a
      library nothing calls has no coverage. It observes three rungs from three
      real surfaces (`src/` for `eligible`, `dist/discovery/discovery-manifest.json`
      for `selected`, a host tree for `projected`) and appends one audit-log-v1
      line carrying an `activation` object (`:238`).
      (c) the receipt-bearing stages in `evaluation_cascade.ts`:
      `CascadeInput.receipt` (`:268`), the stage block (`:381`),
      `RECEIPT_ASSIGNABLE_FAMILIES` (`:141`) and `familyForStage` made total over
      both halves (`:187`).
      **The first conjunct still holds and was re-checked, not assumed.**
      `model_calls` is still the literal `0` on every path, receipt aborts
      included.
      **The second conjunct — the stage list can produce the Phase 1
      classification.** `PREFIX_ASSIGNABLE_FAMILIES` (`:116`) is UNCHANGED at
      `['content','unknown']`: widening it was never the fix, and a later edit
      that widens it reds. What changed is that the prefix is one half of the
      stage list instead of all of it. `runCascade` reaches each of the four
      families, asserted one test per family, and three of the four —
      `content`, `activation`, `unknown` — are reachable from REAL filesystem
      observation rather than from a fixture: `activation_receipt --rule
      commit-policy` reports `family=activation` because that rule is authored
      and selected but not projected into `.claude/rules/`, and that is an
      observation of the tree, not an inference about a candidate.
      **The coverage gap, named rather than absorbed.** `adhered` has no admitted
      evidence source, so the shipped producer cannot emit that rung and a real
      receipt is ABSENT there — which the ladder reads as `unknown` and keeps out
      of every denominator. The `adherence` family is therefore reachable through
      the stage list but not yet from any shipped observer. That is a COVERAGE
      fact about observers, not a stage-list fact, and AC-1's own wording is what
      settles which of the two this step owed: *"the stage list can ASSIGN all
      four Phase 1 families rather than two."* Admitting a fourth source with no
      observer behind it would have made the gap invisible instead of closing it,
      which is the population-of-zero failure 2.2 stays open on.
      **A defect the tests caught before the roadmap could record it.**
      `RECEIPT_ASSIGNABLE_FAMILIES` was first hand-written as the prefix's
      complement, `['activation','adherence','unknown']`. That is wrong: the
      `eligible` rung's family is `content`, so a receipt stage can assign
      `content` too. It is derived from `LADDER` now, and the assertion that
      caught it is kept.
      **RED-proofs, 2026-09-01, each restored byte-identically and re-verified by
      SHA-256** (`tests/scripts/activation_receipt_producer.test.ts`,
      `tests/scripts/cascade_receipt_stages.test.ts`):
      1. TB-2 — defaulted every unobserved rung to `not-reached`: **2 failed**,
         including the real-CLI case. Restored, 21/21.
      2. TB-3 — removed the source/rung mismatch refusal: **1 failed**. Restored.
      3. TB-4 — `appendFileSync` to `writeFileSync`: **2 failed** (the behavioural
         two-line case and the structural scan). Restored.
      4. EC-1 — added `fetch('https://api.anthropic.com/...')` to the producer:
         **1 failed**. Restored.
      5. the wiring — disabled the receipt block in `runCascade`: **4 failed**,
         `activation` and `adherence` both unreachable. Restored, 9/9.
      6. the exclusion — let a PREFIX stage assign `activation`: **4 failed**,
         two of them pre-existing assertions from step 4.1, which is the check
         that the old guarantee is still guarded. Restored.
      Restore verified green: 67/67 across the five touched test files,
      `tsc -p tsconfig.scripts.json --noEmit` clean.
      **Doc-impact.** `docs/contracts/audit-log-v1.md` said the compile-time
      privacy floor binds "two shipped producers" and that a third would be
      caught by nothing. There are three now and the third carries the same
      guard, so the count, the § Producer table and the `activation` field row
      were corrected in the same change. The guard's bluntness is recorded there
      too: the ladder's `reason` field is a `FREE_FORM_KEYS` member, so the
      producer's input field is `precedence_reason` and is mapped on emission —
      widening the key list to admit one safe case would have weakened the floor
      for all three producers.

- [x] **1.2 Settle the twelve-stage enumeration before treating the stage
      semantics as decided.**
      Carried from the same step's unconverged half. An AI council round of
      2026-08-31 returned `REVISE`, degraded at 1 of 2 seats: keep the decided
      twelve-stage arity, but do not treat the stage semantics as settled until
      the receipt trust boundary and the evidence-cost contract are explicit.
      Running the same seat twice produced two materially different twelve-stage
      enumerations, which is why the enumeration is recorded as unconverged
      rather than as decided.
      verify: one enumeration is committed, and a second independent pass
      reproduces it rather than proposing a different twelve.
      **CLOSED 2026-09-01, and the enumeration is COMPUTED rather than
      proposed.** A third proposal would have been a third answer. What settles
      an enumeration that two proposals disagreed on is removing proposal from
      the process: `src/scripts/_lib/cascade_stage_enumeration.ts:87` derives
      `TWELVE_STAGES` from two committed arrays — `CASCADE_STAGES` and the
      ladder's `RECEIPT_STAGES` (`activation_ladder.ts:58`, itself derived from
      `LADDER_RUNGS`) — by one stated ordering rule, stable-sorted on the
      evidence each stage needs. Nobody's judgement is in the output, and
      changing it requires changing an array, which is a visible diff rather than
      a differently-worded reply.
      **The twelve**, published as a machine-checked table in
      `docs/contracts/evaluation-cascade-stages.md`: `schema-validity`,
      `path-ownership`, `holdout-disclosure`, `budget`, `near-duplicate`, then
      the six receipt stages `receipt-eligible` … `receipt-adhered`, then
      `metric-verdict`. E9's condition is met literally — activation/delivery
      and adherence are each their own stage. The statistical stage is LAST,
      which is where the two prior enumerations disagreed, and the reason is the
      ordering rule rather than taste: measurement is the only evidence class
      that requires trials to have been run.
      **The second pass is independent in ROUTE, not in author, and that is the
      point rather than a hedge.** A second author is a second proposal, and two
      proposals is the state that produced the `REVISE`. Route A imports the two
      arrays; route B (`tests/scripts/twelve_stage_enumeration.test.ts`) reads
      the same two source FILES as text, regex-extracts the stage names, reads
      the evidence classes from the published contract table, re-applies the
      ordering rule itself, and never reads `TWELVE_STAGES` except for the final
      comparison. It reproduces the committed twelve exactly.
      **What the reproduction does NOT establish, stated so it is not read as
      more.** Both routes read the same two arrays, so neither is evidence that
      the arrays hold the right rungs or the right stage set. Those are E4 and
      E9, both already decided; reopening either is a decision-revisit matter.
      **One further check derives the ordering rule from BEHAVIOUR**, not from
      the table: the position at which `runCascade` first reads each
      `CascadeInput` field must rise with the evidence-class rank, so a stage
      reordered in the body without its class being updated reds.
      **RED-proofs, 2026-09-01, each restored byte-identically and re-verified by
      SHA-256:**
      7. hand-edited `TWELVE_STAGES` to a different order: **1 failed** — route B
         never reads that constant, which is exactly the property the failure
         mode needed. Restored.
      8. changed one class in the contract table only: **2 failed**. Restored.
      9. added a seventh rung in code without the table: **4 failed**. Restored.
      10. hoisted a read of `input.receipt` above the budget stage: **1 failed**
          on the behavioural ordering check. Restored, 6/6.

- [x] **1.3 State the receipt trust boundary and the evidence-cost contract
      before the producer writes its first receipt.**
      The 2026-08-31 `REVISE` names these two as the precondition for 1.2, and
      1.1 cannot be reviewed without them: a receipt producer that is not
      independent of the thing it observes reproduces the proxy problem one
      layer up.
      verify: both are written down as falsifiable claims, and 1.1's producer
      design cites them rather than restating them.
      **CLOSED 2026-09-01. `docs/contracts/activation-receipt-trust-boundary.md`**
      — four trust-boundary claims (TB-1 no evaluation input decides a rung
      STATE; TB-2 an unobserved rung is absent, never negative; TB-3 every state
      names an admitted source, and an admitted source with no shipped observer
      is itself a refutation; TB-4 append, never rewrite) and three
      evidence-cost claims (EC-1 zero model calls; EC-2 no receipt stage runs
      before the free prefix; EC-3 a missing observation is never bought).
      **Falsifiable in the literal sense the verify clause asks for:** each claim
      states the observation that would REFUTE it, and each refuting observation
      is one a test can make. They are not decorative — the test file asserts
      each claim by its id and each assertion is written as the contract's own
      refutation, so a reader checks the test against the claim rather than
      against a paraphrase.
      **Cited, not restated, by 1.1.** The producer's header
      (`src/scripts/_lib/activation_receipt_producer.ts:9-30`) carries a table
      mapping each claim id to the line of code that binds it, and the contract
      is the only place the claims are written. Both directions were RED-proven
      — see 1.1.
      **TB-1 was sharpened while writing 1.1, and the sharpening is recorded
      because it changes what the claim forbids.** The first draft forbade a rung
      being "derived from a candidate record", which would have forbidden a
      caller naming WHICH artefact a receipt is about. Subject and state are now
      separated explicitly: the subject is an input and decides nothing; the
      state is evidence and may come only from an admitted source.

## Phase 2 — Experimental evidence, blocked on the metered-backend park

Every step here is held by `metered-backend-park`. None of them may be worked
before that blocker is resolved, and none of them may be closed by substituting
a fixture for a run.

**NARROWED 2026-09-01 — the phase is enterable for a metered PROPOSER only, and
the two-session split is part of the discharge rather than a nicety.** See
`blocker: metered-backend-park` → **NARROWED 2026-09-01** for the council record,
the corrected provenance of the lock, and the role constraint. Three conditions
bind every step below:

1. **Role, not label.** A metered call may **generate** candidate text. It may
   not score, rank, filter, select between, or supply any input to the verdict
   for the arms being compared — whatever the module is called.
2. **Independent session.** The park's un-park procedure requires the session
   that freezes the execution protocol and captures results to be independent of
   the one that authored the arm. A single session doing both is not a
   discharge, however green the run.
3. **Protocol frozen first, in writing** — model/provider version, prompts,
   sampling, retry policy, exclusion policy — before any capture. A protocol
   written after a result is a tuned protocol.

The fixture prohibition above is unchanged and is not weakened by any of this.

**EXECUTION HALF ATTEMPTED AND REFUSED BY THE HARNESS, 2026-09-01 (drain run
13). Recorded rather than worked around, and NOT retried.**

The build half of Phase 2 landed in this branch: the metered arm
(`src/scripts/_lib/llm_candidate_proposer.ts`), its transport
(`src/scripts/_lib/llm_proposer_transport.ts`), the entry point
(`src/scripts/llm_propose.ts`, dry by default) and the frozen execution protocol
(`docs/contracts/metered-proposer-protocol.md`). **No metered call was made by
that session — zero requests to any provider API**, which is the state the park's
un-park procedure requires of the authoring session.

The execution half was then dispatched to a **fresh, independent session** —
which is the park's own requirement at
`agents/roadmaps/later/road-to-routing-assurance-live-floors.md:49-52`, *"an
independent session (not the one that authored the corpus) freezes the execution
protocol … BEFORE capturing any baseline"*. That dispatch was **refused by the
host harness's safety classifier** before the session started, because it would
have been authorised to make real paid API calls.

**Why it was not retried, and this is the load-bearing part.** The identical
shape is already on the record one roadmap over:
`road-to-harness-promotion-bridge.md` § `blocker: merge-authority` documents an
autonomous run whose question *"was refused twice by the harness's own safety
classifier before reaching any seat"*, and notes that the run *"stopped rather
than rephrasing its way past a safety refusal, which would have been the
reservation defeated by persistence."* The same reasoning binds here. A softened
re-prompt that got the same work past the same classifier would be persistence,
not authorisation — and the maintainer's pre-authorisation of token spend is not
the classifier's to be argued with by an agent.

**What this changes about Phase 2's state, precisely.** The block is no longer
governance. `metered-backend-park` is narrowed and a metered proposer is
admitted; the arm exists, the protocol is frozen, and the independence split is
designed rather than hypothetical. What remains is a **harness execution
refusal**, which is falsifiable and environment-scoped: it clears the moment a
human runs the frozen protocol themselves, or authorises a session that may
spend. Nothing here is closed on a fixture, and 2.1's verify clause — *"the
comparison is a paired_verdict run, not an argument"* — is carried unweakened.

**One protocol slot is deliberately UNSET and must stay that way until the
executing session closes it: the paired outcome metric and its aggregation.**
The build session left it open because the park names aggregation among the
choices a session under evaluation must not make for itself. Whoever executes
freezes it in writing FIRST, in its own commit, before any capture. A metric
chosen after seeing a result is a tuned metric.

**PHASE 2 — DRAIN RUN 14: CAPTURE REFUSED ON VALIDITY, NOT ON COST OR
CLASSIFIER. 2026-09-01.**

*AI council 2026-09-01 (drain run 14, round 2 on Phase 2), members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, depth deep,
peer-review, blind chairman, quorum 2/2 present (needed 1) — concluded.
Subscription transport, `billable=0`, `$0.0000`. Verdict **QB — do not
capture**, convergent.* Its ratio in one line: *"the current run lacks both a
reproducibly fixed subject and an executable path to the required comparison.
The low cost and green guards do not cure those validity failures."*

**This is NOT the same refusal as drain run 13, and the earlier framing is
superseded on this point.** Drain 13 recorded a **harness classifier** refusal
and called the block *"falsifiable and environment-scoped … it clears the moment
a human runs the frozen protocol themselves, or authorises a session that may
spend."* Drain 14 was authorised to spend and did not spend, because it found a
different and stronger block. Measured this run: a live Anthropic key resolves in
this environment (`~/.event4u/agent-config/anthropic.key`, read at call time by
`load_anthropic_key`, `src/scripts/ai_council/clients.ts:369`), and the whole
capture would cost **about two cents**. So neither cost nor the classifier is
what stops it. What stops it is that the protocol's subject is not reproducible
from a commit and the required comparison has no identified producer. A later
reader must not count this as the same refusal twice.

**Drain 14 made ZERO metered calls.** `--confirm` was never passed and no request
reached any provider API. The dry path was exercised end to end and both arms
were compared under a stubbed generator.

**The four findings, with the COUNCIL's evidence grades — not the reporting
session's.**

- **F-A — the subject is not reproducible from the commit. `Confirmed`.**
  `.claude/` is gitignored in its entirety (`.gitignore:157`; `git ls-files
  .claude` returns 0), and the projection generator SKIPS any rule already
  installed byte-identically at user scope. A fresh generation in a clean
  worktree of this commit reported *"101 rule(s) skipped — byte-identical twin
  already installed at user scope"* and produced 13 files where a stale
  projection of the same HEAD held 15. **The narrow claim, and the council cut
  the wider one:** this proves the run is not reproducible *from the commit
  alone*. It does **not** prove reproduction is impossible from a captured
  manifest plus an environment snapshot. "A number nobody can reproduce" was
  graded overreach and is withdrawn.
- **F-B — the trial unit is undefined, and the corpus sits exactly on the
  discordant floor. `Confirmed`.** `decidePairedVerdict`
  (`src/scripts/_lib/paired_verdict.ts:126`) consumes one signed delta per
  trial and fixes the aggregation itself, so the free choices are what the
  scalar measures and what one trial IS. The protocol says neither. At one
  delta per candidate pair the corpus size (**5**, `max_candidates` in
  `src/config/harness-evolution-budget.json`) equals `MIN_DISCORDANT` (**5**,
  `_lib/paired_verdict.ts:78`), so one tie yields `underpowered`, one dissent
  yields `no-change`, and only a 5-0 sweep can pass in either direction.
- **F-C — no producer of a paired outcome delta has been identified.
  `Confirmed` this run, by an end-to-end trace; it was `Inferred` when first
  reported.** Twelve searches, recorded in
  `agents/evidence/analysis/drain14-phase2-capture-readiness.md` § F-C. The
  short form: the only `decidePairedVerdict` caller in `src/` is
  `_lib/bench_ab_size_claim.ts:101`, whose population is A/B **bench** task
  pairs (`bench_ab_v2_stats.ts:325-344`), not candidate records; the only
  `kind: 'paired'` construction in `src/` is inside `parseRow`
  (`_lib/evolution_roi.ts:536`), a **deserialiser**; `evolution_lab run
  --vector` and `_lib/evaluation_cascade.ts:414-441` both take the vector as
  **caller-supplied input**; and the only vector that has ever reached the verb
  is a hand-authored verdict literal in a test
  (`tests/scripts/evolution_lab.test.ts:550-560`). Nothing reads two
  `CandidateRecord`s and emits a delta. **The claim is "no producer has been
  identified", not "the artefact cannot be produced"** — the council refused the
  categorical form and the refusal stands even now that the trace is done.
- **F-D — the frozen protocol misdescribed itself. `clerical`, and repaired
  this run.** Two halves. (1) It claimed *"The run report records `git
  rev-parse HEAD`"*; `RunReport` (`_lib/evolution_roi.ts:353-359`) has no commit
  field, `run_id` is built from candidate ids (`evolution_lab.ts:871`), and
  `rev-parse` appears nowhere in the closure. The claim is **withdrawn** rather
  than implemented — `llm_propose` writes no run report at all
  (`buildRunReport` is reached only from `evolution_lab run`,
  `evolution_lab.ts:866`), so the field would have described a document the
  capture never emits, and F-A shows a recorded commit would not have been
  sufficient anyway. What is lost is stated in the contract: the protocol now
  claims **no** automatic provenance capture, and comparability rests on the
  operator recording the commit AND the projection state by hand. (2) Three
  stale line citations, repaired, plus eight more found by sweeping.

**Two direct answers this run owes the file.**

1. **Fixing F-A is owner-reserved by default.** Changing corpus membership or
   selection semantics amends a frozen experimental subject. One council seat
   allowed that a purely provenance-preserving pin of the *same* subjects
   *might* be autonomous, but held the equivalence undemonstrated — so the
   default binds and **no manifest was pinned this run**.
2. **`underpowered` does not discharge AC-2.** It is a legitimate execution
   status and it is not a directional result: it records that adjudication was
   unavailable. A run that returns it has not produced the comparison AC-2 asks
   for, in either direction.

**What must happen before any capture means anything, in order.** No step here
is started by this run.

1. An **owner ruling on the corpus contract** — F-A's fix is owner-reserved.
2. **Freeze the complete experimental definition as a whole**: estimand, trial
   unit, pairing, aggregation, independence assumptions, sign convention and
   `tieEpsilon`. The council ruled it is frozen entire or not at all, which
   supersedes the one-slot framing above for the purpose of executing.
3. **Prove the producer gap end to end** — done this run for the current tree
   (F-C), and it must be re-established against whatever tree the capture runs
   on.
4. **Implement the producer and the provenance record.**
5. **Repair citations and re-run the dry path from a FRESH CHECKOUT**, requiring
   identical corpus identity. A dry run in a worktree that inherited a
   projection is not that check.

**Terminal state of drain run 14, stated as such rather than as a stall.** 2.1,
2.2, AC-2, AC-3 and AC-4 all stay open. `metered-backend-park` is **not**
resolved and its 2026-09-01 narrowing stands unchanged; the block recorded here
is **downstream** of that narrowing, not a re-argument of it. Nothing was closed
on a fixture, which is Rank 2 of this file's own Risk Register — *"Phase 2 closes
on a fixture instead of a run"*, risk type `product` — and the paragraph above
is what that mitigation looks like when it fires.

- [ ] **2.1 An LLM proposer must beat the deterministic one to survive.**
      Transferred whole from `road-to-governed-harness-evolution` step 5.4.
      verify: the comparison is a paired_verdict run, not an argument.
      **Already discharged at transfer:** the step's written fallback —
      *"Otherwise the deterministic path stays"* — is mechanically enforced.
      `tests/scripts/proposer_survival_bar.test.ts` asserts no transport import,
      no subprocess spawn, no API host and no key env var across the proposer
      and its dependency, so an LLM proposer cannot silently become the default.
      RED-proven 2026-08-31 by adding a `fetch` to an API host inside the
      proposer module; byte-identical restore returned green.
      **What is still open is the comparison itself.** A paired verdict needs
      two arms and `src/scripts/_lib/llm_candidate_proposer.ts` does not exist;
      `src/scripts/_lib/candidate_proposer.ts` is the only proposer in the tree
      and is deterministic by construction.
      **The verify clause is carried verbatim and was NOT re-scoped.** Both
      seats rejected re-scoping it to match the absence guard: that changes the
      proposition being verified rather than correcting it. The source step's
      `category` was corrected to `future-mechanism` in the same movement, which
      removed a closure right and granted none.
      **SESSION A — THE BUILD HALF LANDED 2026-09-01. THE STEP STAYS `[ ]`, AND
      that is the design rather than a shortfall.** The park's un-park procedure
      requires the session that freezes the protocol and captures results to be
      independent of the one that authored the arm
      (`agents/roadmaps/later/road-to-routing-assurance-live-floors.md:49-52`),
      so a single session doing both is not a discharge however green it comes
      back. This session built the arm and made **zero metered calls**.
      **The second arm now exists**, which was the whole of what 2.1 was blocked
      on — *"a paired verdict needs two arms and
      `src/scripts/_lib/llm_candidate_proposer.ts` does not exist"*:
      (a) `src/scripts/_lib/llm_candidate_proposer.ts` — the arm. Same
      `DefectObservation` input, same `CandidateRecord` output, same id function
      and same input ordering as the deterministic arm, so the two are
      comparable pair-wise over one input.
      (b) `src/scripts/_lib/llm_proposer_transport.ts` — the only file in the
      arm's closure carrying a model endpoint. Dated model ids only; the `high`
      tier is `null` and REFUSES, because no dated `claude-opus-4-1-*` id exists
      in this tree and a floating alias in a frozen protocol is not frozen.
      (c) `src/scripts/llm_propose.ts` — the entry point, dry by default.
      `--confirm` is the only path that spends, and it has never been taken.
      **The role constraint is structural, not intentional.** A metered call may
      generate text and nothing else, and six separate mechanisms make the other
      roles unavailable rather than discouraged: the port's result type carries
      `text` and `model` only and a `NoDecisionField` compile-time assert turns
      any scoring key into a BUILD ERROR; the port takes one request and returns
      one result, so it cannot express a batch or a comparison; one record per
      observation is asserted at the return; an unsatisfiable observation THROWS
      instead of being dropped, so the output can never be a subset; output
      order is `byteCompare` over the INPUT using the deterministic arm's own
      comparator; and the arm imports no verdict module. One test per mechanism.
      **Escalation is decided by a deterministic refusal, never by the model.**
      The first attempt runs on `reason_unknown`, whose ladder is exactly
      `['lite']`; a refusal is classified into a `PathologyWhy` from the refusal
      itself and the walk continues on that class's cheapest untried rung. The
      retry stops at the FIRST contract-valid generation — it never holds two
      valid generations and no code path can express choosing between them.
      **What has NOT happened:** no metered call, no capture, no comparison. The
      transport's live path is unexercised; its request shape is proven by
      `describeRequest` and a unit test over the description, and every
      behavioral test uses a stubbed generator.
      **UPDATED 2026-09-02 (drain run 16) — two of the three remaining
      prerequisites are now built, and the third is a decision.** The
      experimental subject is pinnable and its reconstruction was verified from
      a fresh checkout (`corpus_manifest`, digest `860eaf2dee7f35df`), and the
      paired-delta producer exists (`_lib/candidate_pair_delta.ts`), so the
      verify clause's *"paired_verdict run"* now has both a pinned subject and a
      producer. What is still missing is the outcome metric, and it is missing
      for a reason rather than for want of effort: the frozen corpus's admitted
      mutations cannot move the pre-registered cheap evaluator. See the
      **PREPARATORY WORK 2026-09-02** block above. The verify clause is still
      carried verbatim and still not re-scoped.

- [ ] **2.2 Cheap proposer models first, and track evolution ROI.**
      Transferred whole from `road-to-governed-harness-evolution` step 5.6.
      verify: the ROI figure appears in every run report, and a cheaper model is
      tried before an expensive one on each defect class.
      **Already discharged at transfer, with a production caller:**
      `buildRunReport` (`src/scripts/_lib/evolution_roi.ts:387`) refuses a
      report whose evolution-ROI figure is absent or carries an unknown kind,
      and `evolution_lab.ts:865` calls it on the one path a run completes on.
      Both halves RED-proven, 28/28 green.
      **What is still open is the ordering conjunct.** The guard
      `assertCheapestFirst` (`evolution_roi.ts:215`) exists and is exercised in
      both polarities, and it has **zero production callers** — it polices a
      population of zero, because nothing in the tree makes a metered proposer
      call. A check that scans a population of zero exits green while looking
      like coverage, which is why this is open rather than closed.
      **UPDATED 2026-09-01 — the caller now exists; the live population does
      not.** `proposeCandidatesWithModel`
      (declared `src/scripts/_lib/llm_candidate_proposer.ts:369`, calls
      `assertCheapestFirst` at `:417`) polices the attempts the walk actually
      made, and `plannedAttempts` (declared `:429`, calls it at `:446`) polices
      the dry-run plan, which `llm_propose` reaches with no spend at `:137`;
      `:212` is the `--confirm` path.
      **CITATION REPAIR 2026-09-01 (drain run 14) — factual, not a change of
      verdict.** This paragraph and AC-3 both cited `:369` and `:429` as though
      they were the call sites. They are the function DECLARATIONS; the
      `assertCheapestFirst` calls are twenty-odd lines into each body. Nothing
      about the half-met state changes and no checkbox moves — a reader
      following the old numbers landed on a signature and could not see the
      call the criterion is about. So "zero production callers" is no
      longer true. What is still true is that no LIVE run has produced attempts,
      so the ordering has not yet governed a spent population — see AC-3.
      **A defect found and closed during the build, recorded because the first
      version shipped an unfalsifiable guard.** The walk builds attempts from
      `nextTier` per class, so an out-of-order list is unconstructible and the
      guard's red was NOT producible through the caller — the same defect
      `_lib/candidate_proposer.ts:343-347` records for an output sort it deleted
      for exactly this reason. Found by running the sabotage: sharing one
      spent-map across classes did not make the guard fire, it exhausted the
      ladder early and threw elsewhere. Closed by the `priorAttempts` parameter
      — a budget-aborted run's history is UNTRUSTED caller input validated by
      the same guard, so an inconsistent history reds and removing the guard
      call reds that case. Over an empty history the guard is still
      defence-in-depth, and the module says so at the call.


### PHASE 2 — DISPOSITION 2026-09-01 (drain run 15): 1B, OPEN AND CORRECTLY OPEN

*AI council 2026-09-01 (drain run 15, second round), members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, depth deep,
peer-review, blind chairman, quorum **2/2 present** (needed 1) — concluded.
Subscription transport, `billable=0`, `$0.0000`. Council artefacts are
gitignored and auto-pruned, so every line relied on is inlined here per
`no-roadmap-references`.*

**Verdict 1B — convergent 2/2. Phase 2 stays open, and the roadmap must not
archive.** This run operated under a written owner instruction delegating every
open decision to the council, so the question put was whether that delegation
is enough to run the chain now. It is not, and the reason is specific rather
than general.

**What the delegation DOES reach, and this is new:** the council recorded that
it *"may approve a provenance-preserving corpus contract without further owner
sign-off"* — F-A's routing is no longer owner-reserved-by-default. The drain-14
record said *"one council seat allowed that a purely provenance-preserving pin
of the same subjects might be autonomous, but held the equivalence
undemonstrated — so the default binds."* The default no longer binds; a
manifest-plus-environment snapshot is an **admissible** way to cure F-A.

**What it does NOT reach, and this is what decides 1B.** The seat that carried
the argument put it in one sentence: *"Delegated authority can settle the
corpus contract; it cannot satisfy an independence condition using the same
run."* The un-park procedure's two-session split was never waived — the session
that authors the corpus may not run the comparison — so the final step of the
chain is unreachable by the run that would build the first four.
*"Beginning the chain is not completing it."*

The other prerequisites were re-affirmed as substantive rather than
administrative: F-B leaves the estimand, trial unit, aggregation, independence
assumptions, sign convention and tie handling undefined; F-C establishes that
no candidate-pair delta producer exists; at five candidates the protocol sits
exactly at `MIN_DISCORDANT`, so one tie prevents a directional conclusion; and
`underpowered` explicitly does not satisfy AC-2.

**The equivalence-preserving manifest, specified so the next run does not have
to re-derive it.** Should someone cure F-A, the pin must capture: the
repository commit and the generator implementation/version; the exact ordered
input inventory with byte hashes and provenance; included and excluded paths;
every user-scope rule capable of causing skip behaviour, with content hashes;
generator configuration and the relevant non-secret environment values; the
runtime, dependency, OS and platform facts that can affect projection; the
expected generated-file inventory and hashes; and a reconstruction check
proving that a clean checkout produces the identical experimental subject.

**Resume condition for Phase 2**, unchanged in substance and now recorded as
the file's own: cure F-A with a manifest of the shape above, then freeze the
complete experimental definition (frozen entire or not at all), then implement
the paired-delta producer for F-C, then a fresh-checkout dry re-run, then an
independent session — not the one that authored the corpus — authorised to
spend.

**Nothing was captured, nothing was built, and no criterion moved.** Drain 15
made zero metered calls on this file. The council's own framing of why that is
the right outcome separates *"authority to decide, authority to implement
preparatory work, and satisfaction of an acceptance criterion"* — and holds the
first two while the third is unavailable *"because their required evidence does
not exist."*

**`metered-backend-park` stays open, and is NOT closed with (b).** Its
`Resolved when` offers closure *"with (b) as the recorded disposition"*, and
that option is not taken: the blocker was narrowed to (c) on 2026-09-01 and
that narrowing stands. Closing it as (b) now would overwrite a settled
narrowing with a disposition that contradicts it, in order to make a roadmap
archive. That is the cosmetic closure the same council refused elsewhere in
this run.

### PHASE 2 — PREPARATORY WORK 2026-09-02 (drain run 16): CHAIN STEPS 1, 3 AND 4 DONE; STEP 2 IS AN HONEST NULL

*No council was run and none was needed: this run implemented the preparatory
work the drain-15 1B disposition had already authorised, and made no decision
the disposition reserved. **Zero metered calls. `--confirm` was never passed to
`llm_propose` and no request reached any provider API.** Full evidence, with the
search records and every file:line citation, in
`agents/evidence/analysis/drain16-phase2-preparatory-work.md`.*

**Nothing was captured, no comparison was run, and no acceptance criterion
moved.** 2.1, 2.2, AC-2, AC-3 and AC-4 all stay open, and
`metered-backend-park` stays open with its 2026-09-01 narrowing to (c)
unchanged — it is **not** closed with (b).

**Chain step 1 — F-A is CURED, and the drain-14 record's named mechanism was
wrong.** `src/scripts/_lib/corpus_manifest.ts` and the CLI
`src/scripts/corpus_manifest.ts` capture every field the drain-15 disposition
enumerated; the shape and the equivalence contract are
`docs/contracts/corpus-manifest-v1.md`. `capture` writes the pin, `verify`
re-captures and exits **3** when the SUBJECT differs, reporting every difference
rather than the first. There is deliberately no `update` verb: a pin that can be
refreshed in place is a pin that silently follows the tree.
`subject_digest` folds the enumeration rule and the ordered subject inventory
with hashes and deliberately nothing else, so a node upgrade cannot report a
subject change; the enumeration rule is inside it because the same five files
selected by a different rule is a different experiment.

**The correction, recorded because acting on the old mechanism leads nowhere.**
Drain 14 read the generator's *"101 rule(s) skipped — byte-identical twin
already installed at user scope"* as evidence of the byte-identity dedup.
Probed directly on this branch: `dedupableRules` over the 119 projected rules
returns a skip set of **zero**, because `projection.scope_dedup` appears on no
settings layer this repository carries and therefore defaults off
(`condense.ts:445-459`). The live mechanism is `partitionRulesForDir`
(`src/install/ruleLayerPartition.ts:91`), which withholds a rule when this
host's **global** layer is verified to carry its NAME —
`hostLayerCarries` (`src/install/globalRuleLayers.ts:176-197`) reads names, never
content. **F-A's conclusion is unaffected**: the corpus is still a function of
the operator's home directory rather than of the commit. What was wrong is the
mechanism the reasoning named, and a later reader following it to
`dedupableRules` would have found a function returning an empty set. The manifest
therefore captures BOTH tables — the byte-identity twins and the partition
decision with the global layer's name inventory and its digest.

**Chain step 3 — F-C's producer EXISTS.**
`src/scripts/_lib/candidate_pair_delta.ts` closes the gap drain 14's trace
established: nothing read two `CandidateRecord`s and emitted a signed delta, a
`PairedVerdict`, or a `MetricVector`. Every property of the comparison's SHAPE
is derived from constants committed before either arm existed — the sign
convention from `PairedInput.deltas` (`_lib/paired_verdict.ts:110`), the
direction handling from `MetricDirection`, `tieEpsilon` = 1e-9 from the value
the A/B report's own direction counts already use
(`bench_ab_v2_stats.ts:326-327`), and the aggregation, `ALPHA` and the discordant
floor from `decidePairedVerdict`. The pairing key is reconstructed from the
record as `(dimension, sorted mutation paths)`, because a candidate id hashes
mutated bytes and so differs across arms by construction.
**Pooling answers F-B's floor half:** at one delta per pair the trial count
equals the corpus size (5), exactly `MIN_DISCORDANT`, so one tie makes a pass
arithmetically unreachable before the run starts; `compareArms` pools per-trial
deltas across pairs, and the independence assumption that buys it is stated at
the function rather than assumed away.
**What it does NOT do, in its own header:** it has no live population. No shipped
evaluator emits a `TrialOutcome` for a candidate over the frozen corpus, so
every test supplies its own — the same disclosure AC-3 makes about
`assertCheapestFirst`, made in the same terms rather than quietly omitted.

**Chain step 4 — the fresh-checkout dry re-run PASSED, and the refusal path
passed first.** A detached worktree at `ac0cfd223` with nothing but
`node_modules` symlinked. It had no `.claude/rules` at all, which is F-A in one
line. `capture` there **refused with exit 1** rather than pinning an empty
subject. After `task sync && task generate-tools` it produced **13** files and
logged **101 skipped** — the same numbers as the working tree — and
`verify --manifest` against the working tree's pin returned **SUBJECT
EQUIVALENT, digest `860eaf2dee7f35df`, exit 0, with zero differences printed**.
The chain's *"a dry run in a worktree that inherited a projection is not that
check"* is met literally: the projection was generated in that checkout.
`llm_propose` then ran the dry path there end to end over observations built
from the protocol's own enumeration rule — five planned attempts, all `lite`,
`high` refused as UNPINNED, ~275 input tokens estimated, nothing sent.

**Chain step 2 — F-B is NOT FROZEN, and the reason is a newly established fact
rather than reluctance.** The definition cannot be frozen by derivation over the
currently frozen corpus, because the corpus's admitted mutations cannot move the
one cheap evaluator the pre-registered budget names. Three independent legs,
each stated with what would refute it:

1. **Path.** The corpus is `.claude/rules/*.md`;
   `description_route_check`'s catalogue is loaded from `dist/agent-src/skills`
   and `dist/agent-src/rules` (`src/scripts/description_route_check.ts:386-410`).
   A mutation to a corpus member never reaches the catalogue. *Refuted by* a
   catalogue loader that reads `.claude/`.
2. **Surface.** That catalogue is `name + description` only — `catalogueHash`
   maps each entry to `name` plus `description` (`:81-84`), read from frontmatter
   (`:395`). Both admitted recipes preserve frontmatter byte-identically:
   `keepLeadingBand` cuts at the first `## ` heading
   (`_lib/candidate_proposer.ts:126-140`), `appendHonestEnforcement` appends at
   the end (`:159-164`). *Refuted by* a recipe that rewrites frontmatter.
3. **Arithmetic.** Every trial ties, so `discordant` is 0 against a floor of 5
   and `decidePairedVerdict` returns `underpowered` — which this file's own
   drain-14 record already rules does not discharge AC-2. *Refuted by* a metric
   on which the arms differ.

Freezing a metric known **in advance** to return a non-answer would be a tuned
protocol with the tuning pointing at nothing, and would burn the one-shot
freeze the council ruled is entire or not at all.

**The one committed evaluator a rule-body mutation COULD move** is the A/B
bench: `bench_ab_clone --candidate-record` (`src/scripts/bench_ab_clone.ts:449`)
materialises a candidate into a clone outside the repository, and
`bench_ab_v2_stats.ts:315-345` measures per-task outcomes over it — the same
population the tree's only live `decidePairedVerdict` caller uses. It is an
**agent-run** harness, so its cost is far above the two-cent estimate drain 14
computed for the proposal half alone. That figure covered the proposal only and
must not be read as the cost of the comparison.

**Why this run did not pick between them.** Both exits AMEND the frozen
experimental subject rather than deriving from it: adopting the bench fixes
aggregation for the arms being compared, and re-cutting the corpus changes
corpus membership. Drain 15 widened the delegation to a *provenance-preserving
pin of the same subjects* — a rules-to-skills corpus change is not
provenance-preserving, and drain 14's routing for corpus membership stands.

**The next decision, and it is a decision rather than a build.** Phase 2's
frozen corpus cannot move the pre-registered cheap evaluator. Which amendment
is taken — (a) adopt the A/B bench as the outcome surface and accept its cost,
or (b) re-cut the corpus onto a surface a cheap evaluator measures, accepting
that corpus membership is amended and the pin re-captured? Until that is
answered, chain steps 2 and 5 are both blocked.

**Sensitivity of the new guards, RED-proven 2026-09-02, each restored
byte-identically and re-verified by SHA-256:**
1. removed the enumeration rule from `subjectDigest`: **1 failed**. Restored.
2. removed the unmatched-treatment refusal in `pairCandidates`: **1 failed**.
   Restored.
3. removed the lower-better sign reversal in `pairedDeltas`: **1 failed**.
   Restored.
Restore verified green: **37/37** across the two new test files,
`npm run typecheck` clean.

### PHASE 2 — DISPOSITION 2026-09-02 (drain run 16): 2A, OWNER-RESERVED, AND THE FREEZE ORDERING CORRECTED

*AI council 2026-09-02, members `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
quorum **2/2 present** (needed 1) — concluded. Subscription transport,
`billable=0`, `$0.0000`. Council artefacts are gitignored and auto-pruned, so
every line relied on is inlined here per `no-roadmap-references`.*

**What this run did, and did not do.** It executed the preparatory half of the
resume condition and made **zero metered calls**. F-A is cured: the
equivalence-preserving manifest exists, and a fresh detached checkout
reconstructed the subject to `SUBJECT EQUIVALENT`, zero differences. F-C's
producer exists. The fresh-checkout dry re-run passed, refusing correctly when
`.claude/rules` was absent and reproducing drain-14's 13-files / 101-skips
figures once generated. **No checkbox moved and no acceptance criterion was
claimed.**

**F-B was NOT frozen, and the reason is a new falsifiable finding rather than
reluctance.** The frozen corpus is `.claude/rules/*.md`; the pre-registered
cheap evaluator `description_route_check` loads its catalogue from
`dist/agent-src/` (`:386-410`), that catalogue is `name + description` only
(`catalogueHash`, `:81-84`), and both admitted mutation recipes preserve
frontmatter byte-identically (`candidate_proposer.ts:126-140`, `:159-164`). So
every trial ties, `discordant` is 0 against a floor of 5, and the outcome is
`underpowered` — which this file already rules does not discharge AC-2.
Freezing a metric known in advance to return a non-answer would burn the
one-shot "entire or not at all" freeze.

**Verdict 2A — convergent 2/2, and CONDITIONAL.** Adopt the agent-run A/B bench
(`bench_ab_clone.ts:449`) as the outcome surface: it is the one evaluator a
rule-body mutation can move. 2B was refused because re-cutting the corpus onto a
cheap evaluator's surface *"changes the question from 'Are rule bodies stable?'
to 'Are rule frontmatters stable?'"*. **2C was refused, and the refusal is the
sharpest line in the round:** *"That makes `discordant = 0` an invariant of the
apparatus, not evidence that the mutations have no effect. Calling this an
'honest null' would conflate 'no detectable effect under a capable test' with
'the test cannot observe the intervention.'"* If 2A later proves unaffordable,
the closure to record is **design infeasibility and owner waiver of AC-2**, not
an experimental null.

The conditions attached: demonstrated treatment reachability, controlled
pairing, and an approved power and stopping policy, all before adoption.

**2A IS OWNER-RESERVED. Both seats, unprompted, and this is the operative
finding of the round.** The drain-15 delegation permitted a provenance-preserving
pin of the **same subjects**; 2A *"materially changes the pre-registered
measurement apparatus, trial budget, and evidentiary meaning."* One seat added a
distinction worth keeping: 2A amends the **outcome surface / estimand** while
retaining the same corpus subjects, which strengthens it against 2B without
bringing it inside the delegation. The owner must additionally decide whether
AC-2's notion of a cheap evaluator is itself part of the criterion — if it is,
2A needs an explicit **AC amendment**, not merely a protocol amendment.

**The freeze-ordering tension is resolved AGAINST drain 15, and this roadmap's
own resume condition is corrected accordingly.** The implementing session
recorded the conflict rather than deciding it: the un-park procedure
(`agents/roadmaps/later/road-to-routing-assurance-live-floors.md:49-52`) puts the
protocol freeze in the *independent* session before any baseline capture, while
the drain-15 chain placed it in preparatory work. The council held the stricter
rule binds: *"Prior execution does not cure a compromised independence
safeguard. A later record supersedes an earlier rule only if it explicitly
resolves or replaces the conflicting requirement — not merely because it is
later and 'convergent.'"* One seat offered a reconciliation the other did not
dispute: subject **capture** (F-A) may be preparatory; protocol **freeze** may
not.

**The corrected sequence, replacing the drain-15 ordering for this file:**

1. The owner approves 2A and any AC or budget amendment it implies.
2. Preparatory work produces a complete *candidate* protocol — done, and it is
   a candidate rather than a freeze.
3. An independent session reviews and freezes that protocol.
4. Any baseline captured before that freeze is discarded for evidentiary
   purposes. The F-A manifest and its reconstruction check survive as
   provenance; they are not the frozen baseline.
5. A fresh baseline is captured after the operative freeze.
6. The paired trial runs under the frozen protocol.

**One caveat both seats stated and neither resolved.** One seat noted it could
not verify the three legs of the F-B finding from its own workspace and made its
verdict conditional on them; the other treated them as sound if the cited
implementation holds. The legs are cited to file and line above so the next
reader checks rather than inherits them.

**Nothing was captured, no criterion moved, and `metered-backend-park` stays
open with its (c) narrowing.** It is not closed with (b), for the reason drain
15 gave and this round did not disturb.

## Blockers

### blocker: metered-backend-park
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 (2.1, 2.2) and AC-2
- **What to do:** pick exactly one — (a) resolve the 5.2 evaluator-independence
  decision of 2026-08-25 so a metered backend is admitted for candidate
  evaluation under stated independence conditions, and record the amendment; or
  (b) leave the park standing and leave Phase 2 open, which keeps AC-2
  unsatisfiable and is a legitimate terminal state for this file; or (c) narrow
  the park to permit a metered *proposer* while still forbidding a metered
  *evaluator*, if the independence objection turns out to bind only the
  evaluating side.

  **NARROWED 2026-09-01 (drain run 13) — option (c) TAKEN. A metered PROPOSER is
  admitted; a metered EVALUATOR remains forbidden.** *AI council 2026-09-01
  (`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, deep,
  peer-review, blind chairman, quorum 2/2 present, needed 1 — concluded,
  subscription transport, `billable=0`, `$0.0000`) — Question 3: **3B, 2/2
  convergent.***

  **The lock was read before it was narrowed, and the read corrected this
  entry's own provenance.** This blocker calls the constraint *"the 5.2
  evaluator-independence decision of 2026-08-25"*. Step 5.2 of the archived
  parent (`agents/roadmaps/archive/road-to-governed-harness-evolution.md:1632`)
  in fact says only *"Keep the live-floors park intact. No live harness."* and
  **defers** to a different file. The real lock is
  `agents/roadmaps/later/road-to-routing-assurance-live-floors.md:20-52`, and it
  is that file — not 5.2 — that carries the evaluator-independence reasoning. The
  shorthand was accurate in substance and wrong about where the reasoning lives;
  a later reader following this entry to 5.2 would have found a one-line pointer
  and no argument.

  **Two facts from the real lock decide this narrowing, and neither was
  available from the shorthand.**

  - **Authority is not owner-reserved.** The park states it outright: *"Both
    seats: council-decidable, not owner-reserved. The parent's cut line
    pre-authorises exactly this disposition, the move is reversible, it creates
    no external commitment, and the preservation test passes"*
    (`:44-47`). So a council may narrow it. This is the opposite of the
    `merge-authority` blocker on `road-to-harness-promotion-bridge`, which is
    owner-reserved in both directions — the two must not be reasoned about
    together.
  - **The objection is about evaluating what you authored, not about spending.**
    *"Cost was explicitly not the objection — token spend was pre-authorised. The
    objection is evaluator independence"*, sharpened by one seat to *"it's about
    evaluating an artifact you authored"* (`:27-33`). A metered **proposer**
    generates an arm; it decides nothing. The evaluator for 2.1 is
    `decidePairedVerdict` (`src/scripts/_lib/paired_verdict.ts:126`), which is
    deterministic and whose decision constants — `ALPHA` (`:51`) and
    `MIN_DISCORDANT` (`:78`) — were committed before any arm existed and cannot
    be tuned to a result. So the narrowing does not touch the thing the park
    protects.

  **The narrowing constrains ROLES, not provider labels** — openai's refinement,
  adopted verbatim in substance: *"a 'proposer' that ranks, filters, or supplies
  the controlling verdict could effectively become an evaluator and defeat the
  independence boundary."* Admitted: a metered call that **generates** candidate
  text. Still forbidden: a metered call that scores, ranks, filters, selects
  between, or supplies any input to the verdict for the arms being compared —
  whatever it is named.

  **The park's own un-park procedure binds and is NOT waived.** It requires *"an
  independent session (not the one that authored the corpus)"* to freeze the
  execution protocol — model/provider version, prompts, sampling, retry and
  exclusion policy — **before** capturing any baseline (`:49-52`). Applied here:
  the session that builds the metered proposer arm may not also run the
  comparison. Phase 2 is therefore executed as a two-session split, and a
  single-session run of 2.1 is not a discharge of it however green it comes back.

  **What this does NOT do.** It does not un-park
  `road-to-routing-assurance-live-floors.md`, whose steps need a live *routing*
  harness and are untouched. It does not admit a metered evaluator anywhere. It
  does not relax `tests/scripts/governed_harness_no_live_harness.test.ts`, which
  polices the archived parent's own tree and is not this roadmap's gate.
- **Recommendation:** (b) until someone needs Phase 2's answer. The park does
  not rest on cost — token spend was explicitly pre-authorised when it was
  decided — it rests on evaluator independence, and nothing has changed about
  that argument. Reopening it to unblock a roadmap would be the
  benefit-blocked-by-a-lock case reversed: the lock is the finding.
- **If you do nothing:** Phase 2 stays open indefinitely and AC-2 is never met.
  The obligations remain visible and owned rather than dropped, which is the
  outcome the transfer was for; nothing silently reads as satisfied.
- **Resolved when:** the 5.2 decision carries a recorded amendment naming which
  metered calls are admitted and under what independence conditions, or this
  blocker is closed with (b) as the recorded disposition.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-02 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A receipt producer that observes the thing it reports on | implementation | 1.1's producer is written against the same module that classifies the failure, so the receipt inherits the proxy problem the cascade's `PREFIX_ASSIGNABLE_FAMILIES` exclusion exists to prevent — one layer up, where it is harder to see | 1.3 requires the trust boundary to be written as a falsifiable claim BEFORE the producer is designed, and 1.1 must cite it rather than restate it | Phase 1 — Deterministic evidence, executable under the park |
| 2 | Phase 2 closes on a fixture instead of a run | product | A paired-verdict harness is built, exercised over recorded fixtures, and 2.1 is closed on it — the substitution the source roadmap caught twice, arriving here with the obligation | The Phase 2 preamble forbids closing on a fixture, and 2.1's verify clause is carried verbatim so the word `run` cannot quietly become `case` | Phase 2 — Experimental evidence, blocked on the metered-backend park |
| 3 | This file becomes a parking lot | product | Four obligations arrive, nothing is worked, and the file's existence reads as the problem being handled — the artificial-owner failure both seats warned about | **Mitigation re-reviewed 2026-09-02 (drain run 15): the original one is SPENT.** It read "Phase 1 is executable on the day of transfer", and Phase 1 is now closed 3/3, so it no longer distinguishes a worked file from a parked one. What replaces it: the drain-15 1B disposition records the ordered resume chain and the manifest shape explicitly, so the next reader inherits a specified next step rather than a mood, and AC-3 is annotated as a Phase-2 successor rather than left to look independently closeable | Phase 1 — Deterministic evidence, executable under the park |
| 4 | The transferred evidence is re-credited | implementation | A later reader takes the discharged-at-transfer paragraphs as this roadmap's own work and counts the same sabotage proof twice | Every discharged half names the source step and the date it was proven, and no transferred step carries a `guarded-baseline` annotation of its own — the guards belong to the source file's record | Phase 2 — Experimental evidence, blocked on the metered-backend park |
| 5 | 1B is read as a refusal rather than as a pending chain | product | The drain-15 disposition says Phase 2 stays open. A later reader takes that as "this was decided against" and stops, when what it records is that four of five chain steps are now specified and only the independent spending session is missing | The disposition names the chain in order, specifies the manifest that cures F-A, and states in its own words that "beginning the chain is not completing it" — so the open state is a queue position, not a verdict on the work | Phase 2 — Experimental evidence, blocked on the metered-backend park |

## Acceptance Criteria

- [x] AC-1 — An activation receipt exists that was written by a producer
      independent of the classifier, and the evaluation cascade's stage list can
      assign all four Phase 1 families rather than two.
      **MET 2026-09-01 by step 1.1.** First half: `activation_receipt --rule
      <id>` appends a real line, and the test asserts the append against the real
      repository rather than a fixture. The ledger is local-only by contract
      (`audit-log-v1.md` § File location — "MAY be gitignored in consumer
      projects"), so "exists" rests on a reproducible write, not on a committed
      artefact; a committed receipt is not a thing this contract permits. Second
      half: `PREFIX_ASSIGNABLE_FAMILIES` stays at two and the stage list spans
      four, asserted one test per family. The `adhered` rung has no shipped
      observer, so the `adherence` family is reachable through the stage list and
      not yet from real evidence — a coverage gap named in 1.1 rather than
      counted here.
- [ ] AC-2 — A paired-verdict comparison between a metered proposer and the
      deterministic one has been run, and its result — in either direction —
      is recorded. Held by `metered-backend-park`.
<!-- AC-3 DISPOSITION 2026-09-01 (drain run 15): stays open, as a Phase-2
     SUCCESSOR obligation. Convergent 2/2. The reasoning, recorded because "no
     further code is needed to close it" reads like a completion claim and is
     not one: "'No further code is needed' establishes implementation
     completeness, not acceptance completeness. Its purpose half expressly
     requires one spent population, and none exists."
     And it is explicitly NOT transferred: "Do not transfer AC-3 merely to make
     this roadmap look cleaner. Transfer would require a named, valid
     destination that preserves the exact obligation and its evidence
     requirement; none is established. Keep it attached to the Phase 2 resume
     chain." When Phase 2 completes, AC-3 is the follow-on verification it
     triggers. -->
- [ ] AC-3 — `assertCheapestFirst` has at least one production caller, so the
      ordering it polices governs a real population rather than an empty one.
      **HALF MET 2026-09-01, and left `[ ]` on the half that is not.** The
      caller exists and is on the executable path: `proposeCandidatesWithModel`
      (declared `src/scripts/_lib/llm_candidate_proposer.ts:369`, calling
      `assertCheapestFirst` at `:417`) polices the attempts a run actually made,
      and `plannedAttempts` (declared `:429`, calling it at `:446`) polices the
      dry-run plan, which `llm_propose` reaches without spending (`:137`). Both
      pairs are the repaired citations — see step 2.2's CITATION REPAIR note;
      the declaration lines were previously cited as if they were the calls. The guard is also falsifiable now — an inconsistent resumed
      history is refused, and removing the call reds that case.
      **What is not met is the criterion's purpose clause.** The populations
      that exist today are the all-`lite` dry plan, in which no ordering
      decision arises, and test populations under a stubbed generator. Neither
      is a spent population, so the ordering has not yet governed one.
      **No further code is needed to close it** — Session B's first metered run
      produces the population, and the caller is already there to police it.
      Checking it now would be closing on the half that was already true, which
      is the failure this whole file was transferred to prevent.
      **RE-CONFIRMED 2026-09-02 (drain run 16) by running the dry path from a
      fresh checkout over the real corpus:** all five planned attempts came back
      `tier=lite`, so no ordering decision arose and the population is still not
      a spent one. That is the observation the criterion's purpose clause asks
      about, made rather than assumed, and it leaves the box exactly where it
      was.
- [ ] AC-4 — Programme success and failure criteria were committed before the
      first candidate run, and the run report carries an evolution-ROI figure.
      Transferred whole from `road-to-governed-harness-evolution` AC-8. Its
      shape half is met — `buildRunReport` refuses a report without the figure —
      and its subject half needs the run, which needs the park lifted. `[-]` on
      the source means TRANSFERRED, never met and never dropped.
