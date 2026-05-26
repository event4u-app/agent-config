# ADR 0001 — Per-tier smoke scripts (kernel · router · schema · skills)

> Area: `smoke` · Status: accepted · Date: 2026-05-16 · Type: retrospective
> Roadmap: `agents/roadmaps/step-11-ruflo-parity.md` Phase 4 Step 3
> Supersedes: —

## Context

The North-Star audit
([`external-findings.md § 5`](../../../agents/evidence/audits/2026-05-14-north-star/external-findings.md))
flagged "smoke contracts" as an absorbed Ruflo pattern: every
high-traffic tier needs a fast, deterministic, measurable check that
runs in CI and surfaces regressions before they reach the rules /
router / schema / skill linter pipelines.

The full `task ci` run is ≥ 90 s and exercises every linter. That's
fine for merge gates; it's too slow for path-change feedback on PRs
that touch one tier in isolation.

## Decision

**One smoke script per tier, each ≤ 30 s, each emitting a baseline
declaration as its last stdout line.** Scripts live under
[`scripts/smoke/`](../../../scripts/smoke/):

| Tier | Script | Validates | Path-trigger globs |
|---|---|---|---|
| Kernel | [`kernel.sh`](../../../scripts/smoke/kernel.sh) | 9 kernel rules present, char-budget respected | `.agent-src.uncondensed/rules/**`, `docs/contracts/kernel-membership.md` |
| Router | [`router.sh`](../../../scripts/smoke/router.sh) | `dist/router.json` compiles, all `routes_to:` resolve | `dist/router.json`, `.agent-src.uncondensed/rules/**` |
| Schema | [`schema.sh`](../../../scripts/smoke/schema.sh) | Random skill / rule sample validates against JSON Schema | `scripts/schemas/**`, `.agent-src.uncondensed/{rules,skills}/**` |
| Skills | [`skills.sh`](../../../scripts/smoke/skills.sh) | 5 random skills pass frontmatter + `name == dir` | `.agent-src.uncondensed/skills/**` |

### Runtime contract

Per [`smoke-contracts.md`](../../contracts/smoke-contracts.md) § 1:

| Limit | Value |
|---|---:|
| Wall time | ≤ 30 s |
| External I/O | filesystem only — no network, no MCP |
| Output | last stdout line = baseline declaration |
| Exit code | non-zero on baseline regression |

### CI wiring

[`.github/workflows/smoke.yml`](../../../.github/workflows/smoke.yml)
dispatches each smoke independently on path-trigger match. Local
aggregator: `task smoke` (sub-tasks `task smoke:{kernel,router,schema,skills}`)
wired in [`taskfiles/engine.yml`](../../../taskfiles/engine.yml).

### Baseline declarations (lock-in 2026-05-16)

- Kernel: `9 rules · 23 / 26 kB used (88 %) · 0 fence breaches`.
- Router: `tier_1: N · tier_2: M · 0 unresolved routes`.
- Schema: deterministic seed = epoch day · 10 random files validated.
- Skills: deterministic seed = epoch day · `210 skills · 5/5 pass`.

## Considered alternatives

### Alt 1 — One monolithic smoke (rejected)

Single `task smoke` running every check.

**Why rejected:** path-change PRs pay the full cost every time;
flaky tier-X regression masks tier-Y signal; output is harder to
diff. The per-tier split costs four files and saves CI minutes.

### Alt 2 — Inline-in-`task ci` only (rejected)

Skip the smoke layer; rely on `task ci` for everything.

**Why rejected:** `task ci` is the merge gate, not the feedback
loop. Smokes are the cheap-and-fast layer between push and review.

### Alt 3 — Per-tier, ≤ 30 s budget, baseline-declaring (accepted)

The chosen path. One script per tier, declared budget, declared
baseline, CI-dispatched on path-trigger.

## Consequences

- **Positive:** PRs touching one tier get tier-specific feedback in
  ≤ 30 s; baseline declarations are diff-readable so regressions
  surface in PR descriptions; the `task ci` merge gate stays the
  authoritative full-run.
- **Negative:** four scripts to maintain, one workflow file, one
  taskfile entry. Mitigated by the runtime contract — a smoke that
  approaches 30 s gets split, not optimised in place.
- **Reversal cost:** delete `smoke.yml`; the scripts stay as opt-in
  local checks (`task smoke:*`). No contract churn.

## References

- [`docs/contracts/smoke-contracts.md`](../../contracts/smoke-contracts.md) — runtime + path-trigger contract.
- [`scripts/smoke/`](../../../scripts/smoke/) — four scripts.
- [`.github/workflows/smoke.yml`](../../../.github/workflows/smoke.yml) — CI dispatch.
- [`taskfiles/engine.yml`](../../../taskfiles/engine.yml) — local aggregator.
- [`agents/evidence/audits/2026-05-14-north-star/external-findings.md`](../../../agents/evidence/audits/2026-05-14-north-star/external-findings.md) § 5 — origin pattern.
- [`agents/roadmaps/step-11-ruflo-parity.md`](../../../agents/roadmaps/step-11-ruflo-parity.md) Phase 3 (delivery) + Phase 4 Step 3 (this ADR).
