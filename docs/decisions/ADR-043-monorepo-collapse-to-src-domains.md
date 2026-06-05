---
adr: 043
status: accepted
date: 2026-06-03
decision: monorepo-collapse-to-src-domains
supersedes: ADR-017
superseded_by: —
phase: v6.0.0 · D structural restructure
type: decision
---

# ADR-043 — Collapse `packages/` into `src/domains/` (with boundary safeguards)

## Status

**Accepted** · 2026-06-03. Records the Phase 3 decision gate of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/archive/road-to-6.0.0-d-structural-restructure.md)
(Step 9). Supersedes the per-pack physical layout of
[`ADR-017`](ADR-017-monorepo-physical-layout.md) for the source tree.
Decision routed through the AI council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, design mode, 2026-06-03).

**Executed** · 2026-06-05. The collapse is now carried out: `packages/` no longer
exists at the repo root. The uncondensed source container moved to `src/agent-src/`
([`ADR-051`](ADR-051-uncondensed-source-container-relocation.md)); pack homes moved to
`src/packs/<id>/` (capability packs + core) and `src/domains/<pack>/` (command-bearing),
with ops dirs to root `deploy/` ([`ADR-052`](ADR-052-packages-removal-and-pack-home-migration.md)).
The condensed `.agent-src/` output is byte-identical across the move.

## Context

The decision: collapse the build-time `packages/<pack>/.agent-src.uncondensed/`
source trees into `src/domains/<pack>/`, OR keep per-pack publishing and nest
`src/domains/` inside each package.

### Install-pattern evidence (the gate criterion)

1. The suite ships as **one** npm package `@event4u/agent-config`. The published
   `files` array contains `.agent-src/`, `config/`, `docs/`, `scripts/`,
   `templates/`, `dist/` — it does **not** contain `packages/`. The per-pack
   source tree is build-time only and is never shipped to consumers.
2. **No `packages/*/package.json` exists** — packs are not separately publishable
   npm packages; they are a build-time source organisation.
3. Consumers select pack subsets via `install.py --packs a,b,c`, which operates
   on the discovery projection (`.agent-src/` + discovery manifest) *within* the
   single published package — not by installing separate npm packages.
4. After Phase 2, 15 of 17 packs are empty shells (their only content was
   skills/rules, now in the flat `src/skills/` + `src/rules/` library); commands
   live in `core` + `pack-fun` and declare ownership via the `pack:` frontmatter.

The expected answer — **no subset installs as separate packages** — holds. The
physical `packages/` boundary buys nothing at the consumer interface.

## Decision

**COLLAPSE** `packages/<pack>/` into `src/domains/<pack>/`, with the four
council-mandated boundary safeguards below. The collapse changes only the
build-time source layout; it does not change the shipped npm package shape.

## Council convergence and the boundary risk

Both members converged on **collapse-with-safeguards**, not an unconditional GO.
The shared concern: the `packages/` filesystem boundary is a *forcing function*,
not documentation — collapsing trades compile-time impossibility of cross-pack
coupling for lint-time detection ("build-time architectural decay"). The GO is
conditioned on the boundary being enforced by a lint that walks **actual**
includes, on a re-split proof staying live, on a documented rollback, and on a
path-stability contract.

### Safeguards (status in this repo)

| # | Council-required safeguard | Status |
|---|---|---|
| 1 | One reference extraction re-validated in CI (not all packs every PR) + a documented recipe | **Already in place** — `scripts/prove_pack_extractable.py` + `tests/test_prove_pack_extractable.py` lock laravel's extractability; the recipe is the script's transitive-closure resolver, runnable per pack on demand. |
| 2 | A dependency lint that walks **actual** includes, not just `pack.yaml` metadata | **Already in place** — `scripts/lint_pack_dependencies.py` (Phase-0 Step 3) compares declared `pack.yaml` deps against the real frontmatter `skills:`/`rules:` includes and asserts the pack-graph DAG is acyclic. |
| 3 | A documented rollback / kill-switch criterion | **Documented here** (see below). |
| 4 | A path-stability contract for shipped paths | **Structurally satisfied** — `scripts/_lib/agent_src.py` maps physical `src/domains/<pack>/` and `src/{skills,rules}/` onto stable *logical* paths (`commands/…`, `skills/…`, `rules/…`). The shipped `.agent-src/` logical paths are therefore unchanged by the collapse. The consumer-facing path break of 6.0.0 comes from the root→`src/` move (Step 16) and is carried by `migrate`, not by this collapse. |

The council's central worry — "the lint must walk actual imports, not metadata"
— is exactly what safeguard #2 already does for this repo's markdown-include
dependency model (frontmatter `skills:`/`rules:` is the hard dependency axis;
advisory `see also` links are warnings, per the Step-6 council).

### Rollback / kill-switch criterion (safeguard #3)

Re-split is proven possible (Phase-1 extraction proof), so revert is mechanical,
not archaeological. The collapse is reverted if **either** holds within one
release cycle of landing:

- `lint_pack_dependencies.py` or `prove_pack_extractable.py` records a
  cross-domain dangling reference that cannot be resolved by declaring the
  dependency (i.e. a genuine boundary violation, not a missing `pack.yaml` line);
  **and** the violation recurs after one fix attempt.
- A pack that must ship as a standalone npm package is identified (subset-install
  demand appears) — at which point per-pack publishing is restored by nesting
  `src/domains/<pack>/` back into a package using the documented recipe.

Absent either trigger, the collapse stands.

## Consequences

- **Positive.** One source tree reads as the product (`src/domains/<pack>/<verb>/`);
  the empty-shell packs disappear; the dependency graph is enforced by lint +
  extraction proof rather than by accident of directory nesting; the consumer
  install model is unchanged.
- **Negative / risk.** Architectural discipline now depends on the boundary lint
  rather than module-resolution impossibility — mitigated by safeguards #1–#2
  running on every PR and the rollback criterion in #3.
- **Follow-on.** Step 10 executes the physical move of the `core` + `pack-fun`
  command sets into `src/domains/<pack>/<verb>/` with pack renames; the
  meta-pack split and remaining consolidation stay in 6.0.x / 6.1 per the
  roadmap's scope-line rule.

## Alternatives considered

- **Keep per-pack publishing, nest `src/domains/` inside each package.** Rejected:
  no evidence of subset installs as separate npm packages; preserves a boundary
  that buys nothing at the consumer interface while blocking the "tree reads as
  the product" goal.

## References

- [`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/archive/road-to-6.0.0-d-structural-restructure.md) Step 9.
- [`ADR-017`](ADR-017-monorepo-physical-layout.md) — superseded source layout.
- Council session: anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode,
  2026-06-03 (collapse-with-safeguards convergence).
- `scripts/prove_pack_extractable.py`, `scripts/lint_pack_dependencies.py`,
  `scripts/_lib/agent_src.py`.
