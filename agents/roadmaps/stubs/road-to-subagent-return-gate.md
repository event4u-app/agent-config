---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to a subagent return gate

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
