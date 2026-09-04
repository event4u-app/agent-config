<!-- evidence-type: analysis -->

# The cyclomatic-complexity-delta proposal is refuted, not deferred

Recorded 2026-09-04 by `road-to-deterministic-defect-detectors` step 0.2, so
that a tenth round proposing the same check meets a record rather than a fresh
argument.

## The proposal

An external research pass (`agents/tmp.old/inbox-2026-09-d/set-1/`) asked for a
check that flags a pull request raising a function's **cyclomatic** complexity
by three or more.

## Why it is not adopted

The tree already answered the metric question the other way, and did so with a
stated reason rather than a preference. `src/scripts/_lib/bench_ab_complexity.ts`
rejects cyclomatic by name at `:32-33`:

> `eslint` ships a `complexity` rule, but that is **cyclomatic**, which is the
> metric F9 explicitly rejects — it scores a flat `switch` above a triply-nested
> `if`, so it cannot detect golfing.

The same module implements **cognitive** complexity instead, over the ABI-pinned
tree-sitter pair already in the tree, and states its two deliberate deviations
from the published metric in its own header. The word "golfing" appears three
times in that file (`:8`, `:33`, `:159`) — it is the failure the module exists to
measure, and cyclomatic is unable to see it.

So the refutation is specific: **the delta signal is not rejected, the metric
is.** A threshold of "+3 cyclomatic" would fire on a function that grew a flat
`switch` arm and stay silent on one that gained a third level of nesting, which
is the exact inversion of what a complexity gate is for.

## What a future round should do instead

If a complexity-delta signal is wanted, it reuses
`src/scripts/_lib/bench_ab_complexity.ts` and its metric. That module already
parses the three languages the corpus contains and already exposes per-function
scores; a delta check is a consumer of it, never a second implementation and
never a second metric. Two metrics disagreeing about the same function is the
drift a shared `_lib` exists to prevent.

## What this note does not claim

It does not claim a cognitive-complexity delta check is warranted. Nobody has
measured the false-positive rate of one over this tree's own history, and this
repository does not promote a detector on an unmeasured rate — the same standard
step 3.2 of the roadmap applies to the error-swallow check. The finding here is
narrower and complete: **the metric named in the proposal is already refuted in
the tree, with a file and a line.**
