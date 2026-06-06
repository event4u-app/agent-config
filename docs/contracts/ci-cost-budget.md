---
stability: beta
keep-beta-until: 2026-09-04
---

# CI Cost Budget

> **Status:** active · **Owner:** maintainer · **Opened:** 2026-05-26 ·
> **Review cadence:** quarterly (next: 2026-08-26)
>
> Measured durations + trigger surfaces for every PR-blocking CI job in
> `.github/workflows/`. Sets a per-job wall-clock budget (5 min average)
> beyond which the job either earns its cost in writing or gets a
> follow-up optimisation step. Companion to
> [`release-pr-gating.md`](release-pr-gating.md) and
> [`branch-protection-policy.md`](branch-protection-policy.md).

## Baseline (pre-optimisation, 2026-05-26)

Captured via `gh run list --branch main --limit 50 --json
name,createdAt,updatedAt`. Wall-clock figures are the average of the most
recent 50 main-branch runs.

| Workflow | Job | OS × variant | Avg duration | Trigger surface |
|---|---|---|--:|---|
| `tests.yml` | `install-tests` | 4 shards × 2 OS | 218 s | `scripts/**`, `tests/**`, `src/**`, manifest pins |
| `tests.yml` | `install-aux-tests` | 2 OS | 90 s | same as above |
| `tests.yml` | `python-tests` | 4 versions × ubuntu + 3.12 × macOS | ~210 s | same as above |
| `tests.yml` | `node-tests` | 2 OS | 180 s | same as above |
| `tests.yml` | `windows-lockfile-export` | windows-latest | 60–90 s | same as above (over-broad — see Phase C Step 1) |
| `smoke-public-install.yml` | `smoke` | 3 OS × 2 Node | 413 s | install paths + setup.sh + templates |
| `consistency.yml` | (single) | ubuntu | 27 s | always-on (PR / push) |
| `smoke.yml` | smoke-contracts | ubuntu | 18 s | `scripts/schemas/**` |
| `migration-dry-run.yml` | (single) | ubuntu | 20 s | migration-touching paths |
| `skill-lint.yml` | (single) | ubuntu | 64 s | `.agent-src*/**`, schemas |
| `release-guard.yml` | (single) | ubuntu | < 10 s | tag-trigger only |

**Critical path observations:**

- `smoke-public-install.yml` and `tests.yml` dominate non-release-PR
  wall-clock. Both trigger on `package.json` — a release PR (which only
  touches `package.json` + CHANGELOG + marketplace + pack manifests)
  pulled the full matrix on every bump pre-Phase A.
- `tests.yml` `python-tests` ran four Python versions on Linux + 3.12 on
  macOS on every PR touching `scripts/**`. The 3.10 / 3.11 / 3.13 legs
  are extras: they prove the supported range but rarely surface a
  Python-version-only regression. Moved to a path-filtered sibling
  workflow in Phase C Step 2.
- `tests.yml` `windows-lockfile-export` fired on every PR touching
  `scripts/**` even when the PR never went near `install_global` /
  `cmd_export`. Moved to its own path-filtered workflow in Phase C
  Step 1.

## Expected savings (post-optimisation)

The Phase A guards on `tests.yml` + `smoke-public-install.yml` cut
release-PR critical-path from `218 s + 413 s` (serial worst case ≈ 11
min) to `~30 s` (`Consistency` + `Smoke Contracts` + new `Release
Validation`). Phase C cuts feature-PR critical-path by removing the
Windows leg (60–90 s) and the 3-version Python sweep from PRs that
don't touch Python paths.

| Scenario | Pre | Post | Reduction |
|---|--:|--:|--:|
| Release PR (release/X.Y.Z) | ~660 s | ~60 s | –91 % |
| Feature PR touching scripts/** but no install_global / cmd_export | ~700 s | ~600 s | –14 % |
| Feature PR touching only docs/** | ~30 s (consistency) | ~30 s | unchanged |
| Feature PR touching Python paths only on 3.12 | ~700 s | ~700 s | unchanged (baseline still runs) |

## Per-job cost ceiling — 5-min average

Any job averaging **> 5 min wall-clock** across the most-recent 50
main-branch runs requires one of:

1. A documented justification in this file ("This job protects
   property X; shrinking it would mean losing the regression Y").
2. A follow-up optimisation step opened in the next quarterly review.
3. An ADR superseding the ceiling for this specific job (e.g. integration
   smoke that proves a real consumer-visible promise).

Current jobs above the ceiling: `smoke-public-install.yml` (413 s) —
ceiling violation is acknowledged. The Phase A skip on release PRs
mitigates it; an ADR will follow if it re-exceeds 5 min on feature PRs
post-Phase C.

## Quarterly review checklist

Run the first Monday of every quarter:

1. Re-capture the baseline table via `gh run list --branch main --limit
   50 --json name,createdAt,updatedAt` + arithmetic.
2. Compare each row against the previous quarter; flag any > 25 %
   regression.
3. For every row over the 5-min ceiling, file a follow-up step in the
   open CI-roadmap (or in this file's history if no roadmap is
   currently active).
4. Update the "Expected savings" table once optimisations land so the
   delta is provable, not asserted.
5. Audit the path-filter surfaces — when a workflow keeps firing on
   PRs that don't touch its real scope, tighten the filter.

## See also

- [`release-pr-gating.md`](release-pr-gating.md) — release-PR shape
  predicates, cut surface, kept surface.
- [`branch-protection-policy.md`](branch-protection-policy.md) — required
  status check floor per PR shape.
- `.github/workflows/python-version-sweep.yml` — extras Python versions
  (3.10 · 3.11 · 3.13) on Python-path PRs.
- `.github/workflows/windows-lockfile-export.yml` — Windows leg gated by
  `install_global` / `cmd_export` paths.
