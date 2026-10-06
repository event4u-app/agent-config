---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to a subagent return gate

> **Arrivals:** 28 (at least) - latest `inbox-2026-10-b` (2026-10-01), whose programme
> (`road-to-leading-every-row` blocker b1) recommends option 4 keyed on `no_envelope` —
> read that day in a maintainer checkout's ledger: `no_envelope` 24,964, `absent` 4,543,
> `foreign_object` 54, `fail` 42, `ok` 0, `no_message` 0; `inbox-2026-10-a` (2026-10-01),
> where one of sixteen release reviews asks for producer enforcement until adoption nears
> the whole population and another reads 26 arrivals as no reason to build without a
> recorded false-done incident; earlier: `inbox-2026-09-ab`
> (2026-09-29), `inbox-2026-09-aa` (2026-09-12), a round of
> fourteen independent external reviews of which two reach this subject - and both
> answer the posed question the same way: keep the parking, because the promotion
> preconditions are still absent. One states it as "not on 24 arrivals = build it, but
> on the promotion probe". That is option 1 below, arriving as an argument rather than
> as a new demand. Counted as
> distinct prior round directories under the consumed-inbox tree, which is gitignored -
> so the count is machine-local and the ordering is the finding, not the exact figure.
> Read `(at least)` strictly: a broad keyword sweep returns a larger set that includes
> incidental mentions, so this is the subject-matched floor.

> **The posed owner question — 26 arrivals, no recommended answer.** The
> promotion probe below has never returned true: `no_message` is 0 of 1,751
> post-split stops, `ok` is 0 over the same window, and nothing writes the disk
> envelope the fallback would read. Exactly one of:
>
> 1. Keep the stub on its probe unchanged — it promotes on a reproducible
>    `no_message`, or another precisely defined verdict, and not before.
> 2. Close the stub and record that the branch it keys on has not fired over the
>    measured window, naming the three facts below as that record.
> 3. Build precondition 1 first — a functioning `ok` path — and re-read the probe
>    once a primary channel exists for a fallback to fall back from.
> 4. Re-scope the probe onto a verdict that has fired, and record that
>    `no_message` was not the branch to key on.
>
> The count sets the venue, not the verdict: twenty-five arrivals say the subject
> keeps returning, not that the gate should be built. The measured facts below
> are the evidence, and the count does not change them.

> **Stub — not active work.** Drain-run transfer, 2026-08-22, from
> [`road-to-subagent-lifecycle-integrity.md`](../archive/road-to-subagent-lifecycle-integrity.md)
> Phase 2 Steps 2 and 3. Council disposition 2/2 convergent, recorded in
> [`agents/evidence/council/subagent-lifecycle-closeout-2026-08-22.md`](../../evidence/council/subagent-lifecycle-closeout-2026-08-22.md)
> § Decision 1.

> **Referenced by `road-to-experience-loop-broadening` Phase 2, and the
> reference does NOT reopen this parking.** AI council 2026-08-30, anthropic +
> openai, **2/2 convergent**: this stub parks a gate that BLOCKS parent
> completion on `subagent_stop`; that roadmap's Phase 2 changes how a telemetry
> record is LABELLED after the fact. Nothing is blocked, refused, retried or
> delayed — a line reads `blocked` or `error` instead of `success`. The four
> preconditions below are all properties of a gate that ACTS (an `ok` path to
> fall back from, a recovery producer, demonstrated recovery), and none of them
> is meaningful for a value written into a JSONL line.
>
> **The condition that would make it reopen this parking**, in the council's own
> terms and recorded so a future reader can check rather than re-argue: *the
> changed label is consumed, directly or transitively and without a separate
> discretionary decision, to block, retry, refuse, release, or delay work.*
> Merely informing analysis — even analysis a human later acts on — does not
> meet it. Audited 2026-08-30 against this tree: `envelopeOutcome` has zero
> callers outside its own module, the only reader of `outcome` is
> `src/scripts/extract_audit_patterns.ts` (read-only, stdout, its sole non-zero
> exit is argument validation), and that script is wired into no Taskfile, no
> `gate-coverage.yml` entry and no workflow. **The condition is not met.** If it
> ever is, this parking binds the labelling change too.
>
> Neither of the four preconditions below is discharged by that roadmap, and it
> does not claim any of them.

## What moved here

The `subagent-return-gate` concern on `subagent_stop` — parse
`last_assistant_message` with `validateResponse`; on `no_message`, look for the
declared disk envelope; inject its path via `additionalContext` if found; block
at most once per `agent_id` if both channels fail — **and the four-path snapshot
tests that would cover it** (Step 3). The tests move with the mechanism because
they have nothing to snapshot without it.

**The verdict split the step also carried did NOT move.** Phase 2 Step 2's
part (i) — the four-way verdict — landed in the parent on 2026-08-20, and Step 4
extended it to five on 2026-08-22. Only the *mechanism* is here.

## Why it is not being built

Three measured facts, none of them a scheduling problem:

| Fact | Reading |
|---|---|
| `no_message` = **0 of 1,751** post-split stops | the branch the concern keys on has never fired since the instrument could see it |
| Nothing writes `response-envelope.json` | the disk fallback would find no file and fall through to the block path on its first firing |
| `ok` = **0** over the same window | there is no working primary channel for a fallback to fall back *from* |

Shipping it would be the build-the-mechanism-before-measuring-the-premise
pattern this package has recorded three times.

## Probe — the one that promotes this stub

```
A REPRODUCIBLE `no_message` — OR ANOTHER PRECISELY DEFINED VERDICT — IN WHICH
ALLOWING PARENT COMPLETION PRODUCED AN INCORRECT "DONE".
```

That returning true reopens **investigation**, not enforcement. The two are
separate gates and the council was explicit about it: one observation justifies
analysis and cannot alone justify blocking.

Before any *enforcing* version ships, all four of:

1. a functioning `ok` path — a non-zero successful-envelope rate;
2. an invocation-bound lifecycle identity, so the gate can name what it acted on;
3. a producer for whatever recovery channel is chosen;
4. demonstrated **recovery**, not merely detection, plus false-positive and
   latency readings from an observe-only rollout.

## One inference this stub deliberately does not carry

The parent records that a stop joins to its start 8.0 % of the time (271 of
3,400). One council seat read that as proof `agent_id` is an unsafe blocking
key. The other refused the step: the figure measures failure to recover
**start-side metadata**, and does not by itself show that a stop's own
`agent_id` cannot deduplicate handling of that stop.

The narrower reading is the one recorded, because it is the one the measurement
supports. Whoever promotes this stub still owes a lifecycle-identity
specification — across retries and id reuse — but must not cite 8 % as having
already settled it.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council | option 4 is **not** taken; the stub stays parked and its promotion probe is NOT re-keyed onto `no_envelope` | AI council 2026-10-06, anthropic (claude-sonnet-4-5) + openai (codex-default), 2 rounds, subscription transport, $0 billed, blind-chairman. Both seats classified the question council-decidable and both refused option 4 as the immediate move. Split on what replaces it: anthropic argued option 1 (keep the probe, fix its measurement defect, add an explicit `review_by`); openai argued option 3 (make a positive `ok` control exist first, then re-read the probe), on the ground that with `ok` = 0 a `no_envelope` count cannot distinguish a genuine missing return from a system that never produces a valid envelope at all. The recorded decision is their intersection: not option 4, parking stands, precondition 1 of § Probe is the next thing that must exist. | `ok` becomes non-zero on a real instrumented path — then the probe is re-read against a verdict that can be interpreted, and option 4 is reconsidered on that reading rather than on arrival count |
| D2 | deterministic | evidence | the arrival count is not an input to D1 | the stub already records this ("the count sets the venue, not the verdict"); the 2026-10-06 council independently reached the same reading, one seat naming closure-on-28-arrivals as "resolving by exhaustion rather than by evidence" | a measured incorrect DONE is attributed to an absent expected envelope |

**What the shadow window would have to observe, if option 4 is ever taken.**
Recorded here so the next reader inherits the specification rather than
re-deriving it. Per invocation: whether a valid envelope was expected · whether
the producer ran · whether invocation identity matched · whether the parent
subsequently claimed DONE · whether independent validation found that DONE
incorrect · recovery success, false-positive rate and added latency · separate
counts for instrumentation failure, producer absence, identity mismatch,
malformed/foreign envelope and genuine missing return. The success criterion is
**an incorrect DONE attributable to an absent expected envelope**, never the
occurrence rate of `no_envelope` on its own.

**The measurement defect that prompted this, and its repair.** The programme
blocker `b1` of `road-to-leading-every-row` carried the exit condition
`grep -c 'no_envelope' <this file> -> /[1-9]/`. That read `2` while the decision
was unmade, because both hits sat inside the Arrivals blockquote quoting the
recommendation — an exit a quotation can satisfy. Both council seats named it
independently. It is replaced at the blocker by the condition this section
satisfies: the stub carries a `## Decisions` row recording the chosen option.
A later `grep` for `no_envelope` on this file now matches this section too, so
that string is not an exit condition for anything.
