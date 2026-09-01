<!-- evidence-type: analysis -->

# Governed-evidence Phase 1 and 2 — open questions

Written by the session that executed `road-to-governed-evidence-production`
Phase 1 (steps 1.1-1.3) and the BUILD half of Phase 2 (step 2.1's arm), on
2026-09-01. Each entry is a fork the tree could not settle, with the options and
this session's recommendation. Nothing here is a decision.

## OQ-1 — who freezes the execution protocol

**Status:** resolved in practice by splitting the document; recorded because the
two instructions this session received disagreed, and a later reader should see
which was followed and why.

**The disagreement.** The roadmap's own Phase 2 preamble, condition 2, says the
session that freezes the execution protocol must be independent of the one that
authored the arm. The task instruction for this session assigned deliverable 3
— *freeze the execution protocol, in writing, BEFORE anything is captured* — to
the session that also built the arm. Both cannot hold as stated.

**What the underlying lock actually says.**
`agents/roadmaps/later/road-to-routing-assurance-live-floors.md:49-52`: *"an
independent session (not the one that authored the corpus) freezes the execution
protocol — model/provider version, prompts, sampling, retry and exclusion policy
— BEFORE capturing any baseline"*. The second seat's reason names the discretion
being guarded against: *"model version, retries, exclusions and aggregation
would all have been discretionary choices made by the session under
evaluation"* (`:41-43`).

**How this session split it, and the discriminator it used.** Not
freeze-versus-not-freeze, but **is this clause a description or a choice**:

- A clause that DESCRIBES the arm's code — endpoint, dated model ids, sampling,
  the byte-exact prompts, the retry walk, the output contract — cannot favour an
  outcome, and nobody but the author can write it accurately. Filled.
- A clause DERIVED from a constant committed before the arm existed — the pair
  count from `max_candidates`, the stopping rule from `ALPHA` and
  `MIN_DISCORDANT`, the corpus from a stated byte-wise enumeration — is a
  computation, not a preference. Filled, with the derivation shown.
- A clause that is a genuine CHOICE with an outcome-relevant degree of freedom —
  the paired outcome metric and its aggregation — is exactly what the park
  reserves. Left UNSET and marked as Session B's, in
  `docs/contracts/metered-proposer-protocol.md` § The one slot this document
  leaves open.

**Recommendation.** Keep the split. If the coordinator intended the whole
document to be this session's, the metric slot is the one clause to re-assign
rather than the whole file — filling it here would put the session under
evaluation in charge of the number that decides its own arm, which is the single
thing the park exists to prevent.

**What would falsify the split:** a reading of the park under which describing
one's own code counts as a discretionary choice. This session could not
construct one — a description is checkable against the code it describes, and a
wrong description is a defect rather than a bias.

## OQ-2 — the `high` tier has no dated model id in this tree

**Status:** open, and deliberately failing closed.

`TIER_MODEL.high` is `null`, so `modelForTier('high')` throws. No dated
`claude-opus-4-1-*` id exists anywhere in this repository, and a floating alias
in a frozen protocol is not frozen.

`high` is reachable only through an `execution_failed` escalation
(`_lib/evolution_roi.ts:109`), so a run with no transport error never reaches
it; a run that does hit one gets a loud refusal naming what to pin.

**Options.** (a) Leave it refused, and let a run that needs `high` stop — the
current state. (b) Pin a dated id, recording where it came from, and note it in
the protocol. (c) Remove `high` from the `execution_failed` ladder, which is an
edit to a constant this session does not own.

**Recommendation.** (a) until a run actually needs it. A refusal that names its
own remedy costs one aborted run; a guessed date costs a protocol that reads
frozen and is not.

## OQ-3 — nothing scans the metered arm for a live-harness construct

**Status:** open, named rather than closed, and NOT a gap this session should
close by editing someone else's gate.

`tests/scripts/governed_harness_no_live_harness.test.ts` half B owns every `.ts`
under `src/` whose text contains the slug `road-to-governed-harness-evolution`
and applies a live-harness pattern set to it. The metered arm belongs to
`road-to-governed-evidence-production`, whose park was narrowed on 2026-09-01 to
permit exactly a metered proposer, so that scan should NOT cover it: extending it
would enforce a lock a council has since narrowed.

The consequence is real all the same — no standing scan now asserts that a model
endpoint stays out of the metered arm's other files.
`tests/scripts/llm_candidate_proposer.test.ts` closes it for this arm with a
containment assertion (exactly one file in the arm's own closure may carry a
model endpoint, and it is the transport), but that assertion is local to three
named paths rather than a tree-wide scan.

**Options.** (a) Leave the local containment assertion, and widen it if the arm
grows more files. (b) Add a second slug-keyed scan for
`road-to-governed-evidence-production` with a pattern set that PERMITS the
transport and forbids everything else. (c) Nothing.

**Recommendation.** (a) now, (b) if the metered arm grows past three files. (b)
today would be a gate over a population of three, which is the shape this
roadmap already refuses elsewhere.

## OQ-4 — `assertCheapestFirst` had no falsifiable red until the resume path existed

**Status:** resolved during the build; recorded because the first design shipped
an unfalsifiable guard and a reader should see how it was caught.

The first version called `assertCheapestFirst` on an attempt list the walk built
entirely from `nextTier` per class. That list cannot be out of order by
construction, so the guard's red was not producible through the caller — the
same defect `_lib/candidate_proposer.ts:343-347` records for an output sort it
deleted for exactly this reason.

Found by running the sabotage: sharing one spent-map across classes did not make
the guard fire, it made the ladder exhaust early and throw somewhere else.

Closed by giving the arm a `priorAttempts` parameter for a budget-aborted run's
history — untrusted caller input, validated by the same guard. An inconsistent
history now reds, and removing the guard call reds that case, so the call is
load-bearing rather than decorative.

**What is still true:** over an EMPTY `priorAttempts` the guard still cannot
fire. It is defence-in-depth on the fresh path and a real gate on the resume
path, and the module says so where the call is.
