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

- [ ] **1.1 Produce activation receipts from an independent, append-only
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

- [ ] **1.2 Settle the twelve-stage enumeration before treating the stage
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

- [ ] **1.3 State the receipt trust boundary and the evidence-cost contract
      before the producer writes its first receipt.**
      The 2026-08-31 `REVISE` names these two as the precondition for 1.2, and
      1.1 cannot be reviewed without them: a receipt producer that is not
      independent of the thing it observes reproduces the proxy problem one
      layer up.
      verify: both are written down as falsifiable claims, and 1.1's producer
      design cites them rather than restating them.

## Phase 2 — Experimental evidence, blocked on the metered-backend park

Every step here is held by `metered-backend-park`. None of them may be worked
before that blocker is resolved, and none of them may be closed by substituting
a fixture for a run.

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

- [ ] **2.2 Cheap proposer models first, and track evolution ROI.**
      Transferred whole from `road-to-governed-harness-evolution` step 5.6.
      verify: the ROI figure appears in every run report, and a cheaper model is
      tried before an expensive one on each defect class.
      **Already discharged at transfer, with a production caller:**
      `buildRunReport` (`src/scripts/_lib/evolution_roi.ts:363`) refuses a
      report whose evolution-ROI figure is absent or carries an unknown kind,
      and `evolution_lab.ts:865` calls it on the one path a run completes on.
      Both halves RED-proven, 28/28 green.
      **What is still open is the ordering conjunct.** The guard
      `assertCheapestFirst` (`evolution_roi.ts:191`) exists and is exercised in
      both polarities, and it has **zero production callers** — it polices a
      population of zero, because nothing in the tree makes a metered proposer
      call. A check that scans a population of zero exits green while looking
      like coverage, which is why this is open rather than closed.

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

- [ ] AC-1 — An activation receipt exists that was written by a producer
      independent of the classifier, and the evaluation cascade's stage list can
      assign all four Phase 1 families rather than two.
- [ ] AC-2 — A paired-verdict comparison between a metered proposer and the
      deterministic one has been run, and its result — in either direction —
      is recorded. Held by `metered-backend-park`.
- [ ] AC-3 — `assertCheapestFirst` has at least one production caller, so the
      ordering it polices governs a real population rather than an empty one.
- [ ] AC-4 — Programme success and failure criteria were committed before the
      first candidate run, and the run report carries an evolution-ROI figure.
      Transferred whole from `road-to-governed-harness-evolution` AC-8. Its
      shape half is met — `buildRunReport` refuses a report without the figure —
      and its subject half needs the run, which needs the park lifted. `[-]` on
      the source means TRANSFERRED, never met and never dropped.
