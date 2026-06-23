# Recursive-verification — human-preference pre-test (ADR-106, Phase 3a-pre)

The **first** gate for `road-to-recursive-verification.md`. Cheapest possible
falsification of "is recursion's discipline lift economically real" — runs
**before** the expensive `bench:ab:live` arm and gates it. Per ADR-106:

> Preference < 60 % ⇒ the discipline lift is economically irrelevant; the
> capability-only branch stands and the expensive discipline arm is skipped.

## Why this runs first

The package's existing v2 bench already showed recursion's *discipline* axis is
where any lift would land (capability is null on the tested family). The open
question is not "is there a discipline lift" but "would a human pay for it". A
$15 human read settles that before any multi-dollar benchmark.

## Task selection

Reuse the existing v2 discipline fixtures (no new corpus):

- `internal/bench/ab/fixtures-v2/agL-*` (scope-discipline / downstream-changes family)
- 2 archetypes × ~5 tasks = ~10 tasks total. Pin one host (`claude-haiku-4-5`)
  — this is a *preference* read, not a model comparison.

## Pair generation (the only cost-bearing step — gated)

For each task, produce a pair:

- `attempt₀` — the host's first single-pass output (depth 0).
- `attempt_final` — the output after one recursion round (depth 1: attempt₀ →
  critic verdict → corrective re-attempt), per the `recursive-verification` skill.

> **Spend gate.** Generating the pairs requires ~10 tasks × (1 + critic + 1)
> live calls on a cheap host — order ~$10–15. Surface the estimate and confirm
> before running (Iron Law: no autonomous spend). Until the `package-recursive`
> bench arm exists (Phase 2b live-integration), generate pairs by running the
> recursion loop in-session on the 10 tasks and capturing the two outputs.

## Emission format

One JSON record per task into `pairs.json`:

```json
{
  "task_id": "agL-debug-01",
  "host": "claude-haiku-4-5",
  "attempt_0": "…first-pass output…",
  "attempt_final": "…post-recursion output…"
}
```

## Judging form (≥ 3 humans, blind to which is which)

Present `attempt_0` and `attempt_final` **side by side, A/B-randomised** (the
judge must not know which had recursion). Per pair, ask exactly one question:

> Which output would you rather ship / pay for? **A · B · No difference.**

Record per judge: `task_id`, choice (`A`/`B`/`tie`), and which label was the
recursion output. Tally `preference_rate` = (recursion-preferred) /
(non-tie judgements).

## The gate (ADR-106)

| `preference_rate` | Verdict |
|---|---|
| **< 0.60** | STOP. Discipline lift is economically irrelevant. Capability-only branch stands; **skip** the expensive discipline arm (`D₁` baseline + Phase 3b discipline read). Record the honest-null in `docs/benchmark.md`. |
| **≥ 0.60** | PROCEED to the three-baseline benchmark (`D₀`/`D₁`/`D₂`) — recursion's *novel* discipline lift (`D₂ − D₁`) is worth measuring against cost. |

## Output

1. `pairs.json` — the generated `(attempt₀, attempt_final)` pairs.
2. A tally table — per-judge choices + `preference_rate`.
3. The gate verdict (STOP / PROCEED) recorded in `docs/benchmark.md`, with the
   `preference_rate` and the judge count.
