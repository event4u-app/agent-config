# Council disposition — road-to-subagent-lifecycle-integrity close-out

**Date:** 2026-08-22 · **Members:** 2/2 present (anthropic, openai) ·
**Mode:** `design`, depth `deep`, blind peer review ·
**Cost:** $0.0511 actual.

> **Why the council and not the maintainer.** This session ran under a standing
> autonomous drain mandate in which the council's recorded decision substitutes
> for maintainer sign-off on descope dispositions. That substitution is recorded
> here rather than assumed, because two of the three dispositions below convert
> a step to `[-]` — a disposition the roadmap-progress-sync preservation test
> routes to the owner by default.

## The question

Three open steps, two independent design forks, in a roadmap the drain run
otherwise closed. Question artefact:
`agents/runtime/council/questions/drain-lifecycle-integrity-closeout.md`
(runtime, gitignored — the question is reproduced in the § Options below so the
record survives the retention window).

## Verdict — 2/2 convergent, descope all three

Both seats reached the same disposition on all three items, independently and
under blind peer review. Neither seat argued for shipping any of the mechanisms.

### Decision 1 — Phase 2 Step 2 `subagent-return-gate`, and Step 3 with it

**Verdict: descope to a stub. Step 3 (its snapshot tests) is cancelled with it.**

Options put: (1) ship shadow-only, (2) descope with the null published,
(3) ship a disk-envelope *writer* only and leave the consumer.

Both seats chose (2), and both rejected (3) in the same terms — a writer is not
a narrower version of the mechanism, it is a **new persistence and provenance
boundary** with no observed need. Rationale, as recorded:

- the branch the concern keys on (`no_message`) has fired **0 times in 1,751
  post-split stops**;
- the disk file it would consult has no writer, so the `no_message` branch would
  find nothing and fall through to the block path on its first firing;
- `ok` is **0** across the same window, so there is no working primary channel
  for a "fallback" to fall back *from*. Seat A: *"This isn't a fallback — it's
  the only channel, and it doesn't exist yet."*

**Falsifier that reopens it** (union of both seats, taking the stricter clause
where they differed): a reproducible `no_message` — or another precisely defined
verdict — in which allowing parent completion produced an incorrect "done".
That reopens **investigation**. Enforcement additionally requires a functioning
`ok` path, an invocation-bound lifecycle identity, and a producer for whatever
recovery channel is chosen.

**Recorded disagreement, not resolved by consensus.** Seat A read the 8 %
start↔stop join rate as proof that `agent_id` is an unsafe blocking key
("you might block the wrong lifecycle"). Seat B refused that inference: the
8 % figure measures failure to recover *start-side metadata*, and does not by
itself show that a stop's own `agent_id` cannot deduplicate handling of that
stop. Seat B's narrower reading is carried into the stub, because it is the one
the measurement supports; Seat A's stronger claim is recorded here and is not
asserted as a finding.

### Decision 2(c) — `do_not_touch` matching semantics

**Verdict: descope. Do not select exact, prefix, glob, or an existing matcher.**

Both seats: choosing a matcher would **silently choose the policy language**.
The roadmap has not decided whether a `do_not_touch` entry denotes a file, a
directory subtree, a pattern, or a source reference — and inferring the type
from the spelling (a trailing slash meaning "directory") is the same defect as
the `isPathRef`-shape confusion the step's own text identifies.

Seat B explicitly declined to make segment-boundary directory matching the
presumptive default for that reason, correcting a round-2 reviewer.

**Falsifier that reopens it:** a versioned schema that distinguishes at least
workspace-relative exact files, workspace-relative directory subtrees, and
whether `file:line` refs and globs are supported at all — plus adversarial
matcher tests over `..`, absolute paths, workspace escape, symlinks,
nonexistent targets, case, separators, and malformed syntax.

### Decision 2(d) — publication point

**Verdict: descope. The consumed-file option is struck from the option set.**

`recycle-envelope.consumed.json` is debugging residue and cannot serve as
authorization state. The two seats disagreed on *why*, and the narrower reason
is the one carried: Seat A said the survivor definitionally belongs to a prior
session; Seat B corrected that a successful current-session consumption can
leave a current-session consumed file, so **the defect is indeterminate
provenance, not guaranteed staleness**. Either way the reader cannot tell, which
is what disqualifies it.

Session state written by the consumer is recorded as an unproven design
direction, not a decision.

**Falsifier that reopens it:** a publication mechanism that binds the list to
the *active* invocation (invocation id, producer, workspace, creation time,
expiry, deterministic cleanup) and is provably available before the first
relevant tool call, with concurrency and recycle tests passing.

### Sequencing — (c) and (d) are not independent

Seat A, uncontested: (c) cannot be validated without (d) supplying test data, so
shipping (c) first would canonise semantics for data that cannot reach
enforcement. They descope together, and if either ever ships, (d) goes first.

## One correction the council raised against the question, and its disposition

Seat A flagged an apparent overlap: the question states a five-way verdict
including `foreign_object`, then reports 6 `fail` records "all foreign objects".
That is a defect in the question's wording, not in the classifier. Those 6 rows
were recorded **before** the `foreign_object` split landed in this same drain
run; under the post-split classifier they would read `foreign_object`. The
roadmap's Phase 2 Step 4 text is amended to say so explicitly.

## Hook-chain cost — carried forward, not decided

Both seats noted the `pre_tool_use` chain already runs 11-12 concerns and that a
further concern is a latency cost, not a free addition. No decision was asked
for and none is recorded; it is carried into the `do_not_touch` stub as a
promotion condition.
