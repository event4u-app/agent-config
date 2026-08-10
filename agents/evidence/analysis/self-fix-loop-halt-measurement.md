# Self-fix loop — what the pre-registered ≥50% can and cannot be measured against

> Scope: P2.2 of `road-to-inbox-harvest-2026-08`. The loop shipped; its
> pre-registered threshold did **not** get evaluated, and this note says why in
> the terms the pre-registration itself set.

## The pre-registration

> Pre-registered: ≥50% halt reduction, or the loop is reverted rather than
> narrated.

The verified gap it was written against: the work engine halts to
`Outcome.BLOCKED` on a red check with no attempt counter, "so every red costs a
user round-trip".

## What shipped

A bounded loop in `directives/backend/_self_fix.ts`, wired into both red-check
lanes. Ceiling = 3 (the `autonomous-execution` N=3 budget, per lane because that
rule resets on a different validation target). No-progress floor = two
consecutive identical verdict signatures, checked *before* the ceiling.
Signatures are canonical JSON with sorted keys and volatile keys removed —
without that exclusion `duration_ms` alone would make every re-run sign
differently and the floor could never fire.

## The structural measurement — reproducible, and it is not the threshold

Counted over the engine's own red-check exit surfaces, which is a property of
the code and re-derivable from the diff:

| | user-facing exits (no `@agent-directive:`) | delegating exits |
|---|---|---|
| before | 2 — `test` bad verdict, `verify` bad verdict | 0 |
| after | 2 — the two `PARTIAL` loop exits | 2 — the two retry halts |

So half of the red-check exit surfaces now delegate where none did before, and
**no** red reaches the user on the first occurrence in either lane. The
pre-change numbers are not asserted from memory: they are the four inline
snapshots this change updated, so the old surfaces are readable in the diff.

## Why this is not the pre-registered number

The threshold is about halts in **runs**, not branches in code. Per red check,
user round-trips go from 1 to:

- **0** when the agent resolves the failure within 3 attempts,
- **1** when it does not (delayed by up to 3 agent attempts).

The reduction therefore *equals the agent's within-3-attempts fix rate on red
checks*, and this repository has no data that measures it. The work engine emits
no halt telemetry, and the adjacent orchestration audit stream is the one the
`road-to-subagent-value-realization-followup` blocker already describes as
sample-starved (1 captured line, `provenance: estimated`). Counting the four
code branches above as "halts" and reporting 50% would be reading the metric off
the artefact that was built to satisfy it — the Goodhart move this package's own
discipline forbids.

```
THE THRESHOLD IS UNEVALUATED, NOT MET.
A STRUCTURAL COUNT IS NOT A RUN-LEVEL RATE, AND SAYING SO IS THE FINDING.
```

## What this means for the step

P2.2 stays open. The build half is done and test-pinned (31 new assertions plus
4 updated contract snapshots; 738 work-engine tests green); the measurement half
needs a halt counter the engine does not have. The pre-registration's "or the
loop is reverted rather than narrated" clause is not triggered either — that
clause fires on a *measured miss*, and nothing was measured.

Two honest ways forward, both maintainer calls rather than an agent's:

1. **Instrument, then evaluate.** Emit one line per red-check halt (lane,
   attempt, exit kind) into the existing audit stream, accumulate over real
   runs, then evaluate ≥50% against it. Same shape — and the same
   accumulation-takes-time blocker — as the subagent-value telemetry.
2. **Re-scope the pre-registration** to the structural claim actually provable
   here (no red reaches the user on first occurrence; every loop exit stays
   `PARTIAL` with the failure visible), and record the run-level rate as an
   explicit non-claim.

Nothing in `docs/CLAIMS.md` is touched by this change, deliberately: there is no
measured claim to add.

## The safety half, which was the risk register's actual concern

Risk row 3 of the roadmap reads: "P2.2 ships a loop that hides failures — a
self-fix loop that retries silently converts a visible red into an invisible
one, which is worse than the round-trip it removes." Three of that row's four
named mitigations are shipped and pinned by tests:

- every loop exit is `PARTIAL`, never `SUCCESS` (`exits PARTIAL, never SUCCESS`);
- the red verdict is on the exit surface (`STILL \`failed\``);
- the no-progress floor stops the loop with budget deliberately unspent.

The fourth, the ≥50% pre-registration, is the one this note reports as
unevaluated.
