<!-- evidence-type: analysis -->

# Council record — disposition of two `[~]` items at per-turn-hook-economy closure

**Date:** 2026-08-22 · **Members:** anthropic/claude-sonnet-4-5, openai/codex-default ·
**Quorum:** 2/2 present, threshold 1, concluded · **Rounds:** 2, blind chairman ·
**Cost:** $0.0764 · **Invocation:** agent, `--prompt-mode analysis`

Convened by the Iron-Law-3 deferred-resolution gate: `road-to-per-turn-hook-economy`
read 11/11 done, 2 deferred, all 8 blockers `Status: resolved`, and the closure gate
refuses to auto-archive while `[~]` items stand. The question named the routing
constraint explicitly — dispositions that keep an item alive are council-decidable,
dispositions that drop or weaken it are the owner's — and asked each seat to say
which parts were owner-reserved rather than choosing them.

## Convergent — acted on

**Both items are carried, not cancelled.** Neither seat proposed dropping either.

**Item 1 (step 4.2, the composite bar) is missing infrastructure, not data.**
`claude-sonnet-4-5`: *"'two releases since 14.6.0' doesn't satisfy the arming
precondition. The precondition is >= 10 readings from >= 2 sessions, not >= 2
releases. Time passing doesn't satisfy a data-collection requirement."*
`codex-default`: *"printed measurements are not durable evidence."* Both located the
gap in step 1 of the recorded arming procedure — collection — which has no
implementation.

**The ceiling value is the owner's.** `codex-default`, verbatim: *"Owner-reserved:
selecting the ceiling; cancelling the bar; weakening the precondition; or
permanently accepting observe-only operation."* `claude-sonnet-4-5` placed it with
the owner independently. Collection, aggregation and carrying forward are not
owner-reserved.

**Item 2's standing decision is sequencing, and the dissent does not overturn it.**
`codex-default`: *"It defines an owner-reserved fallback if later evidence shows
that prerequisite cost exceeds the expected wall-clock benefit. No such comparison
is supplied here."* `claude-sonnet-4-5` — the seat whose earlier dissent argued for
cancelling — reached the same conclusion: *"one dissent doesn't overturn a 2/2
convergent council"*, while asking that its weight not be understated.

**No cost-versus-benefit comparison exists for the split.** Agreed by both, and it
is the input the cancellation question needs.

**The evidence in the question was inferred, not confirmed.** `codex-default`
scored most supplied facts as inferred for want of file:line citations and raw
search output, and flagged one claim (the lock escape hatch applying to this
dispatch case) as speculative. Recorded because it bounds what the follow-up may
treat as settled: `road-to-per-turn-hook-economy-carry` B1.3 audits the claimed
P3/P4 closure rather than inheriting it.

## Divergent — two axes, resolved differently

**Axis 1 — one follow-up or two.** `codex-default`: one file, two independently
gated tracks, *"the only stated option that preserves both outcomes while remaining
net-neutral"*. `claude-sonnet-4-5`: two files plus archiving another roadmap for
compliance, because the items are unrelated and *"combining to satisfy a ratchet
while ignoring actual coupling cost is gaming the constraint, not estate
accounting."*

Executed as one file. Two requires archiving a second roadmap in the same change
and no independent case exists for archiving any particular one; manufacturing a
reason would be a worse instance of the gaming the dissenting seat named. A council
split escalates the transition it split on, so the shape question is surfaced to the
owner rather than settled: splitting the file later costs nothing once a second
roadmap reaches archival on its own merits.

**Axis 2 — Track B's shape.** `claude-sonnet-4-5` recommended a discovery phase
(define P5, cost-estimate P1/P2/P5, measure the Phase-4 alternative, then decide)
over committing to sequencing, flagging it as *"arguably owner-reserved because
it's 'should we invest in this at all?'"*. `codex-default` recommended carrying and
sequencing, with the comparison as the input to the owner-reserved cancellation.

Adopted as a step, not a phase, and one of the two stated reasons does not survive:
**P5 is defined.** It is the step's `verify:` — an artefact diff proving every async
concern still writes its artefact — and the roadmap states it *"is a claim about
what the HOST does with `async: true` and is not observable from this repository"*,
i.e. capability-gated on a live host session. The seat read it as undefined because
the question said *"(5) not quoted here"*; that omission was the question's, not the
roadmap's, and it is the sharpest lesson from this run — an under-quoted premise
produced a recommendation aimed at a gap that did not exist. The routing verdict
survives the correction. The surviving reason — no cost comparison — became step
B1.0, whose only output is the two figures `b-async-split-cancellation` needs.

## What was NOT decided here

The `p50_ci` value · cancelling the split · weakening the arming precondition ·
permanently accepting observe-only · whether this becomes two files. Each is either
owner-reserved by both seats or an escalated split, and each has a named home:
`b-composite-ceiling-value`, `b-async-split-cancellation`,
`b-async-split-live-verification`, and the revisit-if on the one-file decision.

**Prompt recorded with the verdict**, per `evaluator-independence`: the question
carried the author's own framing as claims to test, and both seats did test it —
two of the corrections above are refutations of that framing. The run artefact is
session-local and pruned (`ai_council.session_retention_days`); this file is the
durable record.
