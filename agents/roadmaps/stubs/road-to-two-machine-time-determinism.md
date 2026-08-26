---
complexity: lightweight
review_by: 2026-09-23
---

# Stub: road to two-machine time determinism

> **Stub — not active work.** Drain-run transfer, 2026-08-24, from
> [`road-to-deterministic-time-in-gates.md`](../archive/road-to-deterministic-time-in-gates.md)
> — target **AC-2**, outcome state **transferred**. The parent closed with
> every step executed and this one criterion deferred; moved here rather than
> ticked because the missing half needs **a second machine**, which is a
> capability no run on one host can supply.

## The residual, in one sentence

**AC-2's machine-independence half was never run, and cannot be by one agent on
one host.**

What the parent DID establish is narrower and is stated as such: every gate that
takes an instant now takes it from one memoised resolver (`src/scripts/_lib/as_of.ts`)
whose inputs are argv, an env var, and a committed commit date — none of them
machine-local. Two consecutive runs at the same pin are byte-identical on the
authoring host, and the boundary sweep flips exactly one verdict.

That is **not** the same as machine-independent output. Claiming it from a
single machine would be the fabricated evidence this repository's own doctrine
forbids, which is why the parent left it `[~]` rather than `[x]`.

## Why it is capability-gated, not demand-gated

The scope decision is already made — the parent wanted this criterion and
specified it. The only missing input is a second host. Per
[`README.md`](README.md) § The two classes this is a drain-run transfer, promoted
by its own probe below and by nothing in the shared promotion criteria.

## What moved here — the complete list

1. Run the full `as_of`-consuming gate set at one pinned commit on **two
   different machines** (different OS or at least different `$HOME`, different
   CPU arch if available).
2. Diff the two outputs byte-for-byte.
3. Record the result against AC-2 in the archived parent, either as met or as a
   named divergence with the field that caused it.

Nothing else moved. The resolver, its 20 consumers, the `lint_deterministic_time`
gate and every other criterion of the parent are **met** and are not in question
here.

### Named producer

**The repository maintainer**, who is the only party with access to a second
host. An agent session cannot satisfy this by construction.

### Probe, and its measured baseline at transfer

Written as a **comparison**, never a pinned count — the consumer set grows, and a
probe pinned to a number reports FIRED the first time an unrelated gate adopts
the resolver.

```bash
# Clause 1 — how many gates take their instant from the shared resolver?
grep -rl "_lib/as_of" src/scripts/ | wc -l
#   -> 20 at transfer (2026-08-24). The parent's own text says 17, measured
#      2026-08-22: adoption GREW by three in two days without the defect
#      changing, which is exactly why this is a comparison.

# Clause 2 — is there a recorded two-machine result?
grep -rn "two-machine" agents/evidence/ 2>/dev/null | head
#   -> no hit at transfer. A hit naming a pin and two host identifiers is the
#      re-entry condition.
```

**Measured 2026-08-24: 20 consumers, zero recorded two-machine runs.** Re-entry
completes when clause 2 returns a result — met or diverged, either is an answer.

## Dissent, recorded

None. Both the parent's own annotation and this transfer agree the criterion is
unmeasurable from one host; there was no competing reading to record.
