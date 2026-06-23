---
adr: 106
status: accepted
date: 2026-06-23
decision: recursive-verification-benchmark-gate
supersedes: —
superseded_by: —
phase: recursive-verification · Phase 0
type: structural
---

# ADR-106 — Recursive-verification benchmark gate: capability-OR-measured-novel-discipline, not capability-only

## Status

Accepted (2026-06-23). Locks the Phase 0 gate definition for
[`road-to-recursive-verification.md`](../../agents/roadmaps/road-to-recursive-verification.md)
before any live `bench:ab` spend.

## Context

The `recursive-verification` skill (depth-bounded `attempt → critic verdict →
re-attempt`, default `off`) needs a benchmark gate that decides whether its
shipped default flips to `on`/`ask` for a given host. The roadmap's initial draft
proposed **capability-axis-first**: ship only on a capability-axis lift; a
discipline-axis-only lift does **not** pass, on the assumption that the package's
existing always-on rules already deliver the discipline lift, so recursion would
merely duplicate them at ~11× cost.

This gate definition was put to the AI council (manual transport disabled; live
`council run --depth deep`, 3 rounds; members **anthropic/claude-sonnet-4-5** +
**openai/gpt-4o**, 2026-06-23, actual cost $0.0762). Both members independently
converged that **capability-only is the wrong gate**, for a sound methodological
reason; one member (anthropic) also raised a misreading that the host rejected.

### What the council got right (accepted)

- **The redundancy assumption is unmeasured.** The gate assumed recursion's
  discipline lift is redundant with the existing rules *without measuring it*.
  The fix is a **three-baseline** design and an explicit **marginal** lift:
  - `D₀` = bare host (no rules, no recursion)
  - `D₁` = rules only (always-on rules, no recursion)
  - `D₂` = rules + recursion
  - **novel discipline lift = `D₂ − D₁`** — recursion's contribution *over*
    rules-only. Redundancy is now a measured fact, not an assumption.
- **Cheap human-preference pre-test first.** Before any expensive benchmark, show
  ~10 `(attempt₀, attempt_final)` pairs to humans and ask "which would you pay
  for?". If preference < 60 %, the discipline lift is economically irrelevant →
  capability-only gate stands and the expensive discipline arm is skipped (~$15
  to settle the whole dispute). This mirrors the package's cheap-probe-first,
  measure-first culture.
- **Concrete cost ceiling, not "tolerable".** The original "at a tolerable cost"
  is circular. Replace with a measurable ceiling (token multiplier / $-per-task).
- **Per-(host, family) cell**, not host-global — recursion may pass for a weak
  host on one family and fail for a strong host with no headroom.

### What the council got wrong (rejected by the host)

- anthropic framed the gate as a *"fatal flaw because the 0.333 → 1.000 lift is
  already recursion."* This is a **misread** of `docs/benchmark.md`: that lift is
  the *rules'* effect (vanilla → package), measured **without** recursion;
  recursion's marginal lift is unmeasured (that is exactly what Phase 3 runs). The
  valid extraction is the three-baseline design above, not "capability-first is
  fatally wrong."
- A weighted composite metric `w_cap·Δcap + w_disc·Δdisc` (openai) is **rejected**:
  the weights are precisely the unknown the gate exists to discover (anthropic's
  own counter, which the host endorses).

## Decision

The shipped default for `verification.recursive` flips to `on`/`ask` for a
**(host, family) cell** if and only if:

```
capability_lift(host, family) significant       (McNemar on pass-rate, or scorer
                                                  Wilcoxon p < 0.05, ≥6 discordant
                                                  pairs, effect ≥ 0.5)
OR
( novel_discipline_lift = D₂ − D₁ > ε_disc       (recursion over rules-only —
                                                  MEASURED, never assumed)
  AND cost_per_task ≤ ceiling                     (concrete token-multiplier / $)
  AND human_preference_rate > 0.6 )
ELSE off.
```

**Cheap prerequisite (runs first, gates the rest):** the ~$15 human-preference
test. Preference < 60 % ⇒ capability-only gate stands; skip the discipline arm.

**The benchmark must report, per (host, family):** `pass_rate(D₀/D₂)`,
`discipline_score(D₀ / D₁ / D₂)`, `cost(D₂)/cost(D₀)`, and
`human_preference(recursion vs baseline)`. Without the `D₁` (rules-only) middle
term, redundancy cannot be detected; without human-preference, a discipline lift
cannot be validated as economically real.

The first measured cell is `(claude-haiku-4-5, scope-discipline)`; multi-family
expansion waits until data justifies it.

## Consequences

- Phase 3 of the roadmap gains a **rules-only (`D₁`) arm** and a **Phase 3a-pre
  human-preference test**; the gate language changes from "capability-first;
  discipline-only ⇒ STOP" to the two-branch rule above.
- An honest-null is still first-class: capability flat **and** (human-preference
  < 60 % OR `D₂ − D₁` ≤ ε OR cost over ceiling) ⇒ ship nothing, record the null.
- The default stays `off` until a cell passes; no global flip without its own cell.
- Slightly more measurement up front (three baselines + a human pre-test), bought
  cheaply ($15 pre-test gates the expensive arm) — net a more honest gate.

## Alternatives considered

- **Capability-only (original draft).** Rejected: assumes, without measuring,
  that recursion's discipline lift is redundant with the rules.
- **Weighted composite metric.** Rejected: presupposes the weights the gate
  exists to discover.
- **Holistic / qualitative gate (openai round 1).** Rejected: too vague to
  operationalise into a ship/no-ship decision.

## References

- [`road-to-recursive-verification.md`](../../agents/roadmaps/road-to-recursive-verification.md)
- [`docs/benchmark.md`](../benchmark.md) — the existing wrapper-lift A/B evidence.
- Council round: anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-23, deep
  tier (3 rounds), $0.0762 actual.
- [`subagent-orchestration`](../../src/skills/subagent-orchestration/SKILL.md),
  [`verify-budget`](../../src/agent-src/contexts/execution/verify-budget.md),
  `orchestration-benchmark-gate` (`gateVerdict` / `resolveShippedDefault`).
