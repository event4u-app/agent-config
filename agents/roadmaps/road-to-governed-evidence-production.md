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
      (`src/scripts/_lib/llm_candidate_proposer.ts:369`) calls
      `assertCheapestFirst` over the attempts the walk actually made, and
      `plannedAttempts` (`:429`) calls it over the dry-run plan, which
      `llm_propose` reaches with no spend. So "zero production callers" is no
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
<!-- risk-review: v1 | reviewed: 2026-09-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A receipt producer that observes the thing it reports on | implementation | 1.1's producer is written against the same module that classifies the failure, so the receipt inherits the proxy problem the cascade's `PREFIX_ASSIGNABLE_FAMILIES` exclusion exists to prevent — one layer up, where it is harder to see | 1.3 requires the trust boundary to be written as a falsifiable claim BEFORE the producer is designed, and 1.1 must cite it rather than restate it | Phase 1 — Deterministic evidence, executable under the park |
| 2 | Phase 2 closes on a fixture instead of a run | product | A paired-verdict harness is built, exercised over recorded fixtures, and 2.1 is closed on it — the substitution the source roadmap caught twice, arriving here with the obligation | The Phase 2 preamble forbids closing on a fixture, and 2.1's verify clause is carried verbatim so the word `run` cannot quietly become `case` | Phase 2 — Experimental evidence, blocked on the metered-backend park |
| 3 | This file becomes a parking lot | product | Four obligations arrive, nothing is worked, and the file's existence reads as the problem being handled — the artificial-owner failure both seats warned about | Phase 1 is executable on the day of transfer with no blocker above it, so a file with zero movement is a visible fact rather than an excusable one | Phase 1 — Deterministic evidence, executable under the park |
| 4 | The transferred evidence is re-credited | implementation | A later reader takes the discharged-at-transfer paragraphs as this roadmap's own work and counts the same sabotage proof twice | Every discharged half names the source step and the date it was proven, and no transferred step carries a `guarded-baseline` annotation of its own — the guards belong to the source file's record | Phase 2 — Experimental evidence, blocked on the metered-backend park |

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
- [ ] AC-3 — `assertCheapestFirst` has at least one production caller, so the
      ordering it polices governs a real population rather than an empty one.
      **HALF MET 2026-09-01, and left `[ ]` on the half that is not.** The
      caller exists and is on the executable path: `proposeCandidatesWithModel`
      calls it over the attempts a run actually made, and `plannedAttempts`
      calls it over the dry-run plan, which `llm_propose` reaches without
      spending. The guard is also falsifiable now — an inconsistent resumed
      history is refused, and removing the call reds that case.
      **What is not met is the criterion's purpose clause.** The populations
      that exist today are the all-`lite` dry plan, in which no ordering
      decision arises, and test populations under a stubbed generator. Neither
      is a spent population, so the ordering has not yet governed one.
      **No further code is needed to close it** — Session B's first metered run
      produces the population, and the caller is already there to police it.
      Checking it now would be closing on the half that was already true, which
      is the failure this whole file was transferred to prevent.
- [ ] AC-4 — Programme success and failure criteria were committed before the
      first candidate run, and the run report carries an evolution-ROI figure.
      Transferred whole from `road-to-governed-harness-evolution` AC-8. Its
      shape half is met — `buildRunReport` refuses a report without the figure —
      and its subject half needs the run, which needs the park lifted. `[-]` on
      the source means TRANSFERRED, never met and never dropped.
