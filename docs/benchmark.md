# Discipline-Axis Wrapper-Lift Benchmark (v2)

> **Curated composite of two pinned reports** — the weak-host result and the
> strong-host result side by side. It is deliberately NOT auto-generated from the
> single latest `ab-v2` report: a single-report render would bury one host's
> finding (a strong-host null would erase the weak-host lift, and vice versa).
> Regenerate each section from its pinned report with
> `bench_ab_v2_stats.ts --markdown <tmp> <report>`, then update the matching
> section here. Pinned sources:
> weak host = `internal/bench/reports/ab-v2/2026-06-15T03-52-35Z-ab-v2-paired.json`;
> strong host = `internal/bench/reports/ab-v2/2026-07-05T07-00-31Z-ab-v2-paired.json`.

## Honesty labels (read first)

> 1. **Wrapper-lift on a fixed host (`claude-haiku-4-5`), NOT model-vs-model.** Measures what the agent-config package does to ONE host model on a neutral fixture — not a capability ranking.
> 2. **Discipline axis, not capability.** The headline is the *discipline* delta (did it stay minimal / verify / ask / not destroy / update downstream), not whether the goal was achievable.
> 3. **PILOT — low statistical power (N=2 tasks × 12 seed(s)).** Directional only.
> 4. **Paired design**, errored runs excluded; McNemar (capability) + Wilcoxon signed-rank (discipline) + effect sizes.
> 5. **Not comparable to SWE-bench / GAIA / Fable scores** — a different question entirely.

## Weak host (`claude-haiku-4-5`) — Gate verdict: **PASS**

- capability lift significant: `False`
- discipline lift significant: `True`
- status-bucket better (package vs vanilla): `False`

> **Measurable discipline lift (significant).** On the scope-creep / downstream-changes family, a weak host (`claude-haiku-4-5`) leaves the downstream caller un-updated / scope-creeps a large fraction of the time; the package reliably corrects it. The lift is significant on the discipline axis (Wilcoxon p<0.05, every discordant pair favouring the package) AND beats an **equal-length inert-prose placebo** — so it is the package's *content* (its `downstream-changes`/`scope-control` rules), NOT mere prompt-length, that helps. **Honest scope (empirically bounded):** the lift is **weak-host-specific** — a CLEAN strong-host run (`claude-sonnet-4-6`, same tasks, 8 seeds) scored vanilla = package = placebo = 1.00 (no headroom, package redundant). So the package helps a WEAK model that lacks the discipline; a strong model already has it. This matches the package's design thesis (strong hosts self-apply discipline; weak hosts benefit fully). Discipline axis, not capability (both arms make the primary change); this task family (scope/downstream), not a universal claim. It improves *solution discipline*, not model intelligence.

## package lift — `package` vs `vanilla` (n=24 pairs)

### Table 1 — capability axis (expected near-flat by design)

| metric | baseline | treatment | test |
|---|---|---|---|
| pass-rate | 100% | 100% | McNemar p=1.0, h=0.0 |

### Table 2 — discipline axis (the lift)

| metric | baseline | treatment | Δ | test |
|---|---|---|---|---|
| mean discipline | 0.333 | 1.000 | +0.667 | Wilcoxon p=0.0005, rb=1.0 (n≠0=16) |

### Table 3 — cost axis (mean tokens/run, non-errored)

| metric | baseline | treatment | Δ |
|---|---|---|---|
| mean tokens | 90,534 | 992,044 | +901,510 |

## attribution (content vs length) — `package` vs `placebo` (n=24 pairs)

### Table 1 — capability axis (expected near-flat by design)

| metric | baseline | treatment | test |
|---|---|---|---|
| pass-rate | 100% | 100% | McNemar p=1.0, h=0.0 |

### Table 2 — discipline axis (the lift)

| metric | baseline | treatment | Δ | test |
|---|---|---|---|---|
| mean discipline | 0.333 | 1.000 | +0.667 | Wilcoxon p=0.0005, rb=1.0 (n≠0=16) |

### Table 3 — cost axis (mean tokens/run, non-errored)

| metric | baseline | treatment | Δ |
|---|---|---|---|
| mean tokens | 97,528 | 992,044 | +894,516 |

## Status buckets (trajectory)

| arm | runs | error-rate | buckets |
|---|---|---|---|
| vanilla | 24 | 0% | completed:24 |
| package | 24 | 0% | completed:24 |
| placebo | 24 | 0% | completed:24 |

## Methodology

- Host model: `claude-haiku-4-5` (pinned across all arms — a validity requirement, not a model comparison).
- Per-run budget cap: $3.5; placebo injected ~6628 chars of inert prose.
- Arms: vanilla (plugin off) · package (real plugin) · package-rdp (plugin + RDP rules) · placebo (plugin off + equal-length inert prose).
- Corpus: `internal/bench/corpora/ab-trackb-v2.yaml` (5 trap archetypes). Scoring: `bench_ab_scoring_v2.py` (deterministic, no LLM judge).
- Roadmap: `agents/roadmaps/road-to-discipline-axis-benchmark.md`.

## Strong host (`sonnet`, full 30-task corpus) — Gate verdict: **HONEST-NULL**

- capability lift significant: `False`
- discipline lift significant: `False`
- status-bucket better (package vs vanilla): `False`

> **Honest null on a strong host, across the full corpus.** A re-run of the SAME
> package on `sonnet` over the entire discipline corpus — all 5 trap archetypes +
> agentic-debug + a Laravel/PHP downstream trap (`trapE-scope-laravel-01`) — with
> `vanilla` vs `package` × 3 seeds (180 runs, n=84 paired). The discipline axis
> does not move (Δ=+0.000, Wilcoxon p=1.0) and capability is flat-to-slightly-lower,
> because a capable host is *already* at the discipline ceiling on these
> deterministic traps — exactly what the weak-host section predicts. The package
> is a redundant no-op here, **at ~5× the tokens.** This is not a failure: it is
> the empirical bound on the weak-host claim, and it holds in PHP as in TS. **No
> strong-host lift is claimed.**

### Table — `package` vs `vanilla` (n=84 pairs, host `sonnet`)

| axis | vanilla | package | Δ | test |
|---|---|---|---|---|
| capability (pass-rate) | 94% | 89% | −5pp | McNemar p=0.125, h=-0.174 |
| discipline (0–1) | 0.929 | 0.929 | +0.000 | Wilcoxon p=1.0, rb=0.0 (n≠0=5) |
| mean tokens/run | 185,584 | 929,716 | +744,132 (~5×) | — |

- Report: `internal/bench/reports/ab-v2/2026-07-05T07-00-31Z-ab-v2-paired.json` (A6 of `road-to-final-state-and-market-readiness.md`).
- Methodology: identical to the weak-host section (pinned host, deterministic scorer, paired design); the only change is the host model and the full-corpus scope.

## Recursive self-verification (ADR-106) — HONEST-NULL

> **Verdict: recursion is redundant with the always-on rules. `verification.recursive`
> stays `off`. No model got "closer to Fable" — exactly what ADR-106's gate was built to
> disconfirm.** The one retraining-free Sakana-Fugu mechanism (a depth-bounded
> `attempt → critic verdict → re-attempt` loop) was built, shipped behind a gate, and
> measured — and adds nothing over the rules.

Measured the `package-recursive` arm (D₂ = rules + recursion, deterministic scorer-as-critic,
`max_depth=1`) against `package` (D₁ = rules only) on a weak host (`claude-haiku-4-5`),
`capH-debug` archetype × 6 seeds (n=54 paired):

| axis | D₁ (rules) | D₂ (rules + recursion) | Δ (D₂ − D₁) | test |
|---|---|---|---|---|
| capability (pass-rate) | 87% | 87% | 0 | McNemar p=1.0, h=0.0 |
| discipline (0–1) | 0.852 | 0.861 | +0.009 | Wilcoxon p=0.79, rb=0.33, n≠0=3 |

**ADR-106 gate: FALSIFIED** — neither a capability lift (p=1.0) nor a *significant* novel
discipline lift (p=0.79; only 3 discordant pairs, below the ≥6 the gate requires).

**Why, despite a passing human pre-test.** Recursion fired on only **8/29** corpus tasks
(~28%) and produced a differentiated output on **4/29** — with the rules active, the host's
*first* attempt already passes the critic 72% of the time, so recursion is a no-op. A blind
human pre-test on the 4 differentiated pairs preferred the recursion output **4/4**, but those
cases are too rare and the aggregate marginal lift too small (n≠0=3) to register as
significant. The pre-test looked positive on N=4; the paired benchmark falsified it — which is
exactly why ADR-106 required the benchmark, not just the pre-test.

**Honesty scope.** Weak host, `capH-debug` family, deterministic scorer-as-critic, `max_depth=1`.
A model-based critic (Phase 4) was not pursued — gated on this result passing, which it did not.
Cost axis: each recursion run is up to 2× the host calls of a single pass, for a null lift.

- Roadmap: `agents/roadmaps/archive/road-to-recursive-verification.md` (closed honest-null).
- Gate logic: `recursiveGateVerdict` / `resolveRecursiveDefault` (`orchestration_gate.ts`); on a
  falsified gate `resolveRecursiveDefault` resolves `off` — no shipped-default flip.

**Follow-up disposition — TERMINAL** (AI council, anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2026-06-24, deep tier). Both members converged: do **not** pursue a
model-critic / cross-vendor variant. The 72% first-pass rate shows recursion solves the
wrong problem — cost scales with *all* tasks, benefit only on the ~28% tail (best-case
~4–6% lift, would need n≥200 to detect); a model-critic would mostly fire more often and
produce more null-lift re-attempts at higher cost. The real lever is **refining the rules
on the 28% failure tail** (applies to 100% of tasks at zero marginal cost), not recursion.
Recursion-as-a-class is closed; the model-critic's contextual-quality angle, if ever
wanted, is a *different* (quality-review) product, not a recursion follow-up.
