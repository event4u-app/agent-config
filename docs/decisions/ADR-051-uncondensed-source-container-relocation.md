---
adr: 051
status: accepted
date: 2026-06-05
decision: uncondensed-source-container-relocation
supersedes: —
superseded_by: —
phase: v6.0.x · workspace structural cleanup · Phase 1 sub-phase 1a
type: structural
---

# ADR-051 — Relocate the uncondensed source container to `src/agent-src/`

## Status

**Accepted** · 2026-06-05. Lands sub-phase **1a** of
[`road-to-6.0.x-workspace-structural-cleanup`](../../agents/roadmaps/archive/road-to-6.0.x-workspace-structural-cleanup.md).
**Builds on** [`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) (commands →
`src/domains/`) and [`ADR-045`](ADR-045-src-source-layout-and-profiles-as-views.md)
(the flat `src/skills` + `src/rules` library). Routed through the AI council
(`claude-sonnet-4-5` + `gpt-4o`, 2026-06-05).

## Context

The 6.0.0-D restructure moved **skills** → `src/skills/`, **rules** →
`src/rules/`, and **commands** → `src/domains/<pack>/<verb>/command.md`, but
left every other uncondensed artefact category (contexts, personas, templates,
profiles, presets, user-types, ghostwriter, scripts, packs — ~221 files) under
`packages/core/.agent-src.uncondensed/`. That directory was therefore **still
the live uncondensed source** for those categories — `condense.py` (via
`_lib/agent_src.py::_root_specs()` / `artefact_roots()`) walked
`packages/*/.agent-src.uncondensed/` to find it. It was not a dead duplicate.

Collapsing `packages/` (the roadmap's goal) thus requires first giving those
~221 source files a `src/` home and repointing the generator — a real
source-of-truth move, not a delete.

## Decision

Relocate the remaining uncondensed categories into a single container
**`src/agent-src/`** (prefix `""`, original per-category subdir names), and
register it in `_root_specs()` (leaf view) and `artefact_roots()` (container
view, ordered **before** `src/` so the three categories that also exist under
`src/` as a *different* concern — `src/templates` = workspace TS templates,
`src/profiles` = runtime profile-views, `src/scripts` = Python tooling — resolve
to the uncondensed source first, exactly the precedence
`packages/core/.agent-src.uncondensed/` held).

A **collision guard** in `_root_specs()` now raises if two roots emit the same
non-empty logical prefix (silent overwrite of one category's condensed output
by another's was the council's named #1 failure mode).

### Council convergence and the execution refinement

The council converged on **per-category `src/<category>` roots** with logical
prefixes (Option A), mirroring `src/skills`→`skills/`. Execution refined that
to the **single `src/agent-src/` container** because per-category physical
names collide with the three pre-existing `src/` dirs above, which would break
six `artefact_roots()`+category-append consumers (the profile loader and five
test conftests resolving `root / "templates" / "scripts"`, `root / "scripts"`,
`root / "profiles"`). The container delivers the council's stated #1 priority —
no generated-tree corruption, no collision — with **zero consumer edits**,
keeps the source under `src/` (the council rejected a root-level
`.agent-src.uncondensed/` for reverting the at-`src/` direction), and preserves
logical identity exactly.

## Consequences

- The condensed `.agent-src/` output is **byte-identical** before/after the
  move (the decisive correctness gate; verified by snapshot diff). Consumers
  see no change.
- `generate_pack_manifests` collects the **core** pack's artefacts from both
  `packages/core/.agent-src.uncondensed/` and `src/agent-src/`, so the core
  pack manifest stays byte-stable — the move is metadata-neutral.
- Gate path-integrity (`check_gate_paths`) now asserts targets resolve under
  the **source tree** (`src/` / `packages/`) rather than `packages/core/`; the
  four gates it guards (`lint_agents_md`, `audit_command_surface`,
  `audit_initial_context`, `inventory_abstraction_budget`) were repointed to
  the new homes. `audit_command_surface` was additionally repointed from its
  pre-existing Step-10 silent-no-op (it read the evals-only `packages` commands
  dir) onto the real `src/domains/` command surface — now audits 161 commands.

## What this ADR does NOT do — the deferred blocker

Sub-phase 1a relocates the **artefact source only**. It does **not** remove
`packages/`, because `packages/` also hosts a **live pack-home / manifest
layer**: `pack.yaml` + `README.md` (+ `FIRST_WIN.md`) for 11 capability packs
(finance, gtm, founder-strategy, ops-people, and the language packs) that are
**not** in `src/domains/`, plus `packages/core/installer/` (superseded by
`src/cli`+`src/install`+`src/server`), `packages/core/deploy/`, and
`packages/cloud/telemetry-worker/`. These are not mirrored elsewhere; deleting
them would violate the roadmap's acceptance criterion ("no skill/rule/command
deleted beyond duplicates proven already-mirrored").

**Where the 13 pack homes + installer + deploy + cloud worker migrate is an
open design decision** (e.g. `src/domains/<pack>/` homes vs a dedicated
`src/packs/` home; the semantics of capability-packs-as-domains) and is routed
to a follow-up council session + its own staged PR — consistent with the
roadmap's Goal that Phase 1 and Phase 2 ship as separate, never-bundled PRs.

## Alternatives considered

- **Per-category `src/<category>` roots (council Option A)** — rejected at
  execution for the six-consumer collision breakage above.
- **Root-level `.agent-src.uncondensed/`** — rejected by the council for
  reverting the at-`src/` flat-library direction.
- **Add `packs:` frontmatter to ~180 shared artefacts** — rejected as invasive
  and orthogonal; the container preserves attribution without touching content.

## References

- [`road-to-6.0.x-workspace-structural-cleanup`](../../agents/roadmaps/archive/road-to-6.0.x-workspace-structural-cleanup.md)
- [`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) · [`ADR-045`](ADR-045-src-source-layout-and-profiles-as-views.md) · [`ADR-050`](ADR-050-workspace-vs-package-root-boundary.md)
- `src/scripts/_lib/agent_src.py` — `_root_specs()`, `artefact_roots()`, collision guard.
