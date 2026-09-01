<!-- evidence-type: analysis -->

# Governed harness evolution — the terminal-disposition question, asked and ANSWERED

**Status: ANSWERED AND EXECUTED 2026-09-01. Verdict below; the question
follows it verbatim.**

**What happened after the verdict, recorded here because the question body
below still describes the pre-transfer world and would otherwise read as
current.** The owner accepted the convergent disposition — option (e), a
transfer to an owned receiver — and authorised its estate cost on the same
day. All four obligations moved whole and unweakened to
`agents/roadmaps/road-to-governed-evidence-production.md`, with every
`verify:` clause carried verbatim and every source item marked `[-]`
TRANSFERRED rather than `[x]`. `road-to-governed-harness-evolution` thereby
reached 0 open, 0 deferred and 0 guarded baselines, and is now at
`agents/roadmaps/archive/road-to-governed-harness-evolution.md`. Every path
the question body names for that roadmap is therefore an ARCHIVE path now.

**Where the executed transfer departed from the seats, in the two places it
did.** The cheapest-first ordering obligation sits in the receiver's metered
phase rather than its deterministic one — the anthropic seat's illustrative
list said otherwise, but the criterion both seats named puts it there, since
`assertCheapestFirst` polices the order of metered tier attempts. And AC-8
travelled rather than staying as a permanent honest null: the seats diverged,
and the source file's own definition of `[-]` (TRANSFERRED, never met and
never dropped) plus AC-9's existing disposition settle it without the agent
choosing a side.

This was the AI-council question for the four items that remain open on
`road-to-governed-harness-evolution`. It was committed as an artefact so the
next run would not have to re-derive it, and so the framing it was asked under
is auditable rather than reconstructed. It has now been run **unchanged**, and
the verdict is recorded here rather than in a council response path — those live
under `agents/runtime/council/`, which is gitignored and auto-pruned, so citing
one from a durable artefact is a build failure.

**One caveat on the question body below.** Every `file:line` in it was read at
commit `52e0287af`. Line anchors in this repository have gone stale before;
re-read them before relying on them. The question was run unchanged, so the
verdict was formed against those anchors as they stood.

**Why it sat pending for a day.** Both configured seats share one user-global
daily CLI-call counter and it was exhausted for the UTC day the question was
prepared — `anthropic 50/50`, `openai 51/50`. The counter is date-keyed and
resets at 00:00 UTC; on 2026-09-01 it read `6/50` on both seats. The metered API
rung was never used, in either run: `api_on_quota: off`.

## The verdict — 2 of 2 convergent, on the load-bearing question

Run 2026-09-01. Members: `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, both subscription transport, **$0.00 billed**, quorum
2/2 present after the run.

**Convergent — none of the four items is closeable on its existing evidence.**
Both seats reject closure, and both reject the two routes that would have
produced one:

1. **No retroactive re-scoping of a `verify:` clause.** The openai seat: editing
   the clause to match what was built "changes the proposition being verified"
   rather than correcting it. The anthropic seat, on the same point: the clause
   was committed before the implementation, and rewriting it turns a
   pre-committed success criterion into an editable account.
2. **No closing a conjunction on its met half.** Both seats read a parent `[x]`
   over a transferred-away conjunct as a record that implies the conjunction
   passed. Obligations transfer *whole*; the parent may become `[-]` once a
   receiver genuinely owns it, never `[x]`.

**Convergent — step 5.4's `category: absence-assertion` is a documentation bug,
not a closure opportunity.** Its `verify:` names a `paired_verdict` comparison,
which is a mechanism that does not exist, while `absence-assertion` carries the
right to close `[x]` once sabotage-verified. Both seats prescribe the same fix:
**recategorise to `future-mechanism` and keep the `verify:` clause verbatim.**
Applied in this change — the recategorisation removes a closure right and grants
none.

**Convergent — the disposition is option (e), a transfer to a genuinely owned
receiver, and it is not executable yet.** Both seats condition the transfer on a
receiver that has an accountable owner, an accepted scope, and the two written
estate exemptions that a new active file requires while both ratchets sit at
zero headroom. The openai seat states the consequence plainly: *"until that
receiver exists, leave them open."* Neither existing sibling qualifies —
`later/road-to-routing-assurance-live-floors` is the source of the 5.2
constraint but is scoped to routing assurance, `road-to-harness-promotion-bridge`
is scoped to the promotion bridge, and `later/` was already rejected as a
destination by the 2026-08-31 council because it leaves the active estate.

**Divergent — the shape of the receiver, and the treatment of AC-8.** The
anthropic seat proposes one new roadmap with two phases split on the trust
boundary (deterministic receipt production, executable under 5.2; metered
paired evaluation, blocked by it) and would leave AC-8 in place as a permanent
honest null, on the ground that AC-8 is *this* programme's acceptance criterion
and transferring it obscures that the programme did not meet it. The openai seat
would transfer all four intact and leave them open until the receiver exists,
and warns that "these obligations need a home" is by itself not enough to spend
an estate exemption. The two are compatible in direction and differ on whether
AC-8 travels.

## What therefore remains owner-reserved, and is not decided here

Creating the receiver is not an agent decision: it consumes two estate-exemption
keys against ratchets at zero headroom and it requires an accountable owner,
which is exactly the thing an agent cannot supply for itself. Under the
owner-reserved table in `decision-revisit-gate`, that is the owner's call. The
four items therefore stay `[ ]` with their `guarded-baseline` annotations, and
the roadmap stays unarchived by design rather than by oversight.

**What would show this record to be wrong:** the 5.2 evaluator-independence
decision being reopened and a metered backend admitted (which would make items
2–4 executable in place); or a receiver arriving with an owner, at which point
the transfer is executable exactly as both seats describe it.

---


`agents/roadmaps/road-to-governed-harness-evolution.md` stands at 46 steps done,
4 open, 10 transferred out to a sibling. This question is about the disposition
of the four that remain. It is one decision, applied to four items; say if your
answer differs for any of them.

## What each of the four is, and what the tree shows at this commit

Every `verify:` clause below is a conjunction. In each case at least one
conjunct is met by production-wired, sabotage-proven code, and the remaining
conjunct needs a capability that does not exist in this repository.

**Item 1 — step 4.1, "Cascade cheap to expensive, abort on the first hard
failure."**
`verify: a candidate failing the cheapest stage consumes no model call, and the
stage list can produce the Phase 1 classification.`
- First conjunct MET. `src/scripts/_lib/evaluation_cascade.ts` is a six-stage
  deterministic prefix (`schema-validity → path-ownership → holdout-disclosure
  → budget → near-duplicate → metric-verdict`) that aborts on the first hard
  failure. `model_calls` is the literal type `0` on every path, so the property
  follows from the type rather than from a counter. It is wired into the real
  runner (`evolution_lab.ts` `verbRun`), 15/15 green, and sensitivity was
  observed in three directions including one probe that found a real gap.
- Second conjunct NOT MET. The Phase 1 classification is the four-value
  `content | activation | adherence | unknown`
  (`src/scripts/_lib/activation_ladder.ts:53`). The prefix may assign only two
  of them: `PREFIX_ASSIGNABLE_FAMILIES` (`evaluation_cascade.ts:84`) is
  `['content','unknown']`, and `activation` / `adherence` are excluded by
  construction, because assigning either from a deterministic proxy would
  manufacture evidence.
- What the missing half needs: the receipt-bearing stages, which need an
  independent, append-only receipt producer with version-bound attributable
  observations. The receipt SCHEMA exists (`docs/contracts/audit-log-v1.md:89`
  carries an optional `activation` object) and the CLASSIFIER exists
  (`activation_ladder.ts:173` `classifyFailure`). The PRODUCER does not: a grep
  over `src/` for `ActivationReceipt` returns the declaring module and nothing
  else, and no code writes an `activation` object into an audit line. Producing
  one means observing real activation, i.e. harvesting production traces.
- An earlier council round on this step (2026-08-31) returned `REVISE` and was
  degraded at 1 of 2 seats. Its verdict: keep the decided twelve-stage arity,
  but do not treat the stage semantics as decided until the receipt trust
  boundary and evidence-cost contract are explicit. Running the same seat twice
  produced two materially different twelve-stage enumerations, which is why the
  enumeration is recorded as unconverged rather than as settled.

**Item 2 — step 5.4, "An LLM proposer must beat the deterministic one to
survive."**
`verify: the comparison is a paired_verdict run, not an argument.`
- NOT MET, and unreachable. A paired verdict needs two arms.
  `src/scripts/_lib/llm_candidate_proposer.ts` does not exist;
  `src/scripts/_lib/candidate_proposer.ts` is the only proposer in the tree and
  is deterministic by construction.
- The step's own written fallback — "Otherwise the deterministic path stays" —
  is now mechanically enforced rather than merely written:
  `tests/scripts/proposer_survival_bar.test.ts` (4/4) asserts no transport
  import, no subprocess spawn, no API host and no key env var across the
  proposer and its dependency, so an LLM proposer cannot silently become the
  default. Sensitivity observed: a `fetch` to an API host inside the proposer
  turns it red, byte-identical restore returns green.

**Item 3 — step 5.6, second conjunct, "a cheaper model is tried before an
expensive one on each defect class."**
- First conjunct MET with a production caller: `buildRunReport`
  (`src/scripts/_lib/evolution_roi.ts:363`) refuses a report whose
  evolution-ROI figure is absent or carries an unknown kind, and
  `evolution_lab.ts:865` calls it on the one path a run completes on. 28/28
  green, both halves red-proven.
- Second conjunct NOT MET. The ordering guard `assertCheapestFirst`
  (`evolution_roi.ts:191`) exists and is exercised in both polarities, but a
  grep over `src/` and `tests/` returns zero production callers. It polices a
  population of zero, because nothing in the tree makes a metered proposer
  call — the same absence as item 2.

**Item 4 — acceptance criterion AC-8**, "Programme success and failure criteria
were committed before the first candidate run, and the run report carries an
evolution-ROI figure."
- First conjunct satisfied, but vacuously: the criteria file was committed
  2026-08-30 and no candidate run has happened at all.
- Second conjunct's shape half MET, same evidence as item 3's first conjunct.
- What is absent is THE RUN. A `run` invocation today clones candidate trees and
  evaluates nothing; its honest ROI kind is `unmeasured`. A candidate run in this
  programme's sense evaluates candidates against an eval corpus over repeated
  trials, which needs a metered backend.

## The constraint that blocks items 2, 3 and 4

Step 5.2 of the same roadmap forbids a live model harness anywhere in it, and
`tests/scripts/governed_harness_no_live_harness.test.ts` (9/9 green) enforces
that. 5.2 is not a preference of this roadmap: it rests on a recorded 2-of-2 AI
council decision of 2026-08-25 whose stated objection was EVALUATOR
INDEPENDENCE, not cost — token spend was explicitly pre-authorised at the time.
That decision is not in question here and is not being reopened.

## Who could receive transferred work, checked rather than assumed

- `agents/roadmaps/later/road-to-routing-assurance-live-floors.md` — the parked
  roadmap that holds the live-harness decision above. Its own scope, read at
  this commit, is ROUTING ASSURANCE: a frozen live baseline of the routing
  corpus, floors derived from it, and a catalogue-pressure suite. It does not
  cover candidate proposal, candidate evaluation, or activation-receipt
  production. So it is the source of the constraint but not a natural owner of
  items 1–4.
- `agents/roadmaps/road-to-harness-promotion-bridge.md` — active, split out of
  this same roadmap on 2026-08-31. Its subject is the promotion bridge and its
  single gate is an owner-reserved merge-authority decision. It does not cover
  evaluation, proposal or receipts.
- A NEW roadmap. `check_estate_count` on this commit reports
  `active_roadmaps 3 (floor 3, +0)` and `later_roadmaps 75 (floor 75, +0)` —
  both ratchets sit at zero headroom, so any new file, active or parked, raises
  a floor at its ceiling and requires two written exemption keys justifying it.
- Relevant precedent that cuts against parking: on 2026-08-31 an AI council
  (2/2 convergent) decided the Phase 7 transfer out of this same roadmap and
  explicitly REJECTED `agents/roadmaps/later/` as a destination, because
  `later/` is excluded from the progress dashboard and from the
  `/roadmap:process-*` command family and so does not preserve active-estate
  membership.

## A contract rule that bears directly on item 2, stated because omitting it would steer the answer

These items carry a `guarded-baseline` annotation, a documented sub-state of
`[ ]` defined in `docs/guidelines/agent-infra/guarded-baseline.md` (itself an AI
council decision of 2026-08-31, 2/2 convergent). That contract defines exactly
two categories and gives them different closure rights:

> An **`absence-assertion`** step asserts something directly observable today
> ("the schema has no field capable of holding prompt text") and MAY close `[x]`
> once sabotage-verified. A **`future-mechanism`** step asserts a property of
> something that does not exist and is what this sub-state exists for.

The categories actually recorded on the three steps are:

- item 1 (step 4.1): `category: future-mechanism`
- item 2 (step 5.4): `category: absence-assertion`, with
  `red_proof: sabotage run 2026-08-31 — 1 failed / 3 passed, restored 4/4` and
  `sabotage_model: added a fetch to an API host inside the proposer module`
- item 3 (step 5.6): `category: future-mechanism`

So item 2 is categorised as the kind that may close once sabotage-verified, and
it is sabotage-verified. The tension is that its `verify:` line as written names
a `paired_verdict` comparison, which is a future mechanism, while the property
its guard actually pins is the present-tense absence the category describes.
Whether that makes item 2 closeable as it stands, closeable only after the
`verify:` line is re-scoped to match the recorded category, or not closeable at
all, is part of what this question asks.

## Repository conventions any answer must respect

- A step is marked `[x]` only when its own `verify:` clause is satisfied by
  produced evidence. Closing a conjunction on its met half alone is recorded
  here as a named past defect.
- `[-]` means TRANSFERRED to a named receiver — never cancelled, never
  satisfied. The obligation moves verbatim and unweakened and the receiver must
  genuinely own it.
- A check that scans a population of zero exits green while looking like
  coverage, which this repository treats as worse than no check.
- An honest null is an acceptable and recordable outcome.
- These four items currently carry a `guarded-baseline` marker which blocks the
  roadmap from being archived while they stand.

## The decision

Choose one disposition for the four items, noting any item you would treat
differently:

**(a)** Leave all four open indefinitely in this roadmap, accepting that it
never reaches a terminal state while the capabilities they need are unowned.

**(b)** Re-scope each `verify:` clause to the half reachable under this
roadmap's own declared constraints, recording the struck-through original and
the rewrite in the step, close the step, and carry the unreachable conjunct as
a named exit criterion on a receiver.

**(c)** Descope by transfer: mark the unreachable conjuncts `[-]` TRANSFERRED,
reproducing each obligation verbatim in a receiver, and close the parent items
on what remains.

**(d)** Build the missing capability inside this roadmap where the 5.2 park does
not forbid it — which on the evidence above would mean item 1's receipt
producer only, since items 2–4 need a metered backend and item 1 does not,
although producing receipts means harvesting production traces.

**(e)** Something else you specify.

For your chosen option please state: the receiver, if any, and why that receiver
rather than the alternatives listed above; whether creating a new roadmap file
is justified given both estate ratchets sit at zero headroom; whether your
answer differs per item; and what later evidence would show the choice to have
been wrong. If you consider any of the four closeable on its existing evidence
without a re-scope, say which, and name the conjunct you read as satisfied.
