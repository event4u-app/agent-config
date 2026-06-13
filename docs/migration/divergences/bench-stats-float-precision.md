# Divergence: bench statistics float precision (`pstdev` / `median` / `quantiles`)

## Script

Affects every bench report that aggregates savings via the `statistics`
module. Surfaced first in:

- Python: `src/scripts/bench_condense_memory.py` (`statistics.pstdev` at the
  `stdev_saving_pct` field)
- TypeScript: `src/scripts/bench_condense_memory.ts` (`_pstdev`, line ~225)

Shared helper with the same shape: `src/scripts/_lib/bench_telegraph.py`
↔ `src/scripts/_lib/bench_telegraph.ts` (`_pstdev`, line ~304).

## Symptom

`bench_condense_memory` JSON report, `stdev_saving_pct` field, on the current
tree (after the 2026-06-13 `main → python2ts` sync changed some condensation
inputs, e.g. `dist/agent-src/templates/AGENTS.md` 2481 → 2590 chars):

- **Python output:** `"stdev_saving_pct": 3.544402882224057`
- **TS output:** `"stdev_saving_pct": 3.5444028822240576`
- Affected channel(s): written file (`internal/bench/reports/telegraph-v2.json`)

A single-ULP difference in the last mantissa digit. Most inputs are
bit-identical; only some hit the divergence.

## Root cause

Python's `statistics.pstdev` (and `median`, `quantiles`) compute the
sum-of-squares / order statistics **exactly** using rational `Fraction`
arithmetic, converting to `float` once at the very end. The TS twins use a
naive floating-point reduction:

```ts
const variance = data.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / n;
return Math.sqrt(variance);
```

Naive float accumulation rounds at each addition; the order and intermediate
rounding differ from Python's exact-then-convert path, so the final `float`
can land one ULP away for certain input distributions.

## Verdict

`formatting-only` — the divergence is a last-ULP floating-point artifact with
no semantic or consumer impact (the value is a benchmark percentage; a
1e-15 difference changes no decision). It is **not** `regression-must-fix`:
the TS arithmetic is a defensible IEEE-754 reduction, just not bit-identical
to Python's exact-Fraction path.

A full byte-identical fix requires replicating Python's `statistics._ss`
exact-`Fraction` summation in TS (BigInt-rational arithmetic) across the
shared bench-stats helpers. That is tracked as a follow-up
(`agents/roadmaps/road-to-typescript-only-scripts.md`, bench-stats
exact-fraction parity); it is non-trivial and out of scope for the sync that
surfaced it.

## Evidence

`tests/scripts/bench_condense_memory.test.ts` →
*"python vs tsx produce byte-identical reports (modulo generated_at)"*
normalizes non-integer numbers to 12 significant figures before comparison
(`roundFloats`). 12 sig-figs tolerates the single-ULP stats divergence while
still failing on any real (> 12-significant-digit) drift. Integer fields
(char counts, call/error tallies) are never rounded, so structural drift
still fails the test.

## Approval

- Reviewer: AI-council (anthropic/claude-sonnet-4-5 + openai/gpt-4o), debate, converged
- Date: 2026-06-13
