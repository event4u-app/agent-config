---
adr: 050
status: accepted
date: 2026-06-05
decision: workspace-vs-package-root-boundary
supersedes: —
superseded_by: —
phase: v6.0.0 · D structural restructure · Step 16 closure
type: structural
---

# ADR-050 — Workspace-vs-package root boundary (Step 16 closure)

## Status

**Accepted** · 2026-06-05. Closes Step 16 of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/archive/road-to-6.0.0-d-structural-restructure.md).
**Refines** [`ADR-045`](ADR-045-src-source-layout-and-profiles-as-views.md): ADR-045's
profiles-as-views and hard-break decisions stand unchanged; this ADR refines
ADR-045's stated *root inventory* against the executed reality. Routed through the
AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode, 2026-06-05;
converged 2-round) which both members signed off on the trust-boundary framing.

## Context

ADR-045 specified an end-state where `src/` is "the whole package, structured" and
"root keeps only tooling/agent-host essentials + `src/` + `tests/` + `taskfiles/`",
with `src/app/` holding the TS runtime and `src/internal/` holding maintainer infra.
Step 16's remaining work (`internal/`, `hooks/`, the maintainer `agents/` workspace)
forced a re-examination, and three facts emerged that ADR-045's diagram did not
account for:

1. **The repo is a dual-artifact workspace, not a monolith.** It ships an npm
   package (`src/`) *and* hosts a maintainer workspace (CI, evals, benchmarks,
   council runtime, roadmaps, settings). These have different lifecycles, trust
   boundaries, and consumers. Forcing workspace tooling under `src/` implies it is
   a package internal when it is a workspace peer of `.github/`.
2. **`hooks/hooks.json` is pinned to the plugin root by an external convention.**
   Claude Code plugins auto-discover hooks at `<plugin-root>/hooks/hooks.json`
   (`condense.generate_plugin_hooks()` writes `PROJECT_ROOT/hooks/hooks.json`;
   `.claude-plugin/marketplace.json` ships it). Moving it under `src/` silently
   breaks plugin hook discovery in every marketplace-install consumer — a coupling
   invisible to static grep (the council rated `hooks/` "1 ref, trivial" without it).
3. **`src/app/` was never created; flat `src/{cli,server,install,shared,ui}` is the
   executed reality** and is *more* correct for a dual-artifact repo than the false
   `src/app/` module boundary the diagram assumed.

The council's converged verdict: the value of Step 16 was structural clarity for the
*package*; that is achieved. The remaining dirs have design blockers, not
implementation laziness, and the honest disposition is a documented trust boundary
plus deferral — not contorting workspace tooling to fit a diagram drawn for the
wrong repo shape.

## Decision

1. **Two root tiers, by trust boundary.**
   - **Package source — `src/`** (shipped via npm `files[]`): `app`-equivalent
     entrypoints (`cli/`, `server/`, `install/`, `shared/`, `ui/` — kept flat under
     `src/`, *not* under a `src/app/` wrapper), `domains/`, `skills/`, `rules/`,
     `flows/`, `profiles/`, `config/`, `templates/`, `scripts/`, `schemas/`.
   - **Workspace tooling + external-convention anchors — root** (not shipped as
     package source): `internal/`, `agents/`, `.github/`, `taskfiles/`, `docs/`,
     `hooks/`.

2. **Kept-at-root exception set (final for 6.0.0), with rationale per dir.**

   | Dir | Class | Why it stays at root |
   |---|---|---|
   | `docs/` | external convention | GitHub renders `docs/`, npm `files[]`, ~386 cross-refs + 5 generator/verifier scripts hardcode it (decided 2026-06-05, pre-this-ADR). |
   | `hooks/` | external convention | Claude Code plugin spec auto-discovers `<plugin-root>/hooks/hooks.json`; moving it breaks consumer hook discovery. |
   | `internal/` | workspace tooling | `bench/ docker/ evals/ schemas/ workers/` — never shipped; 117 repo-local refs; a workspace peer of `.github/`, not a package internal. |
   | `agents/` | workspace tooling + namespace | Maintainer roadmaps/settings/runtime; 443 refs; `agents/settings/.agent-settings.yml` is read at runtime by `_lib/agent_settings.py` (self-referential move hazard); collides conceptually with the consumer-facing `agents/` convention the package ships. **Deferred — see below.** |

3. **`src/app/` is not created.** Flat `src/{cli,server,install,shared,ui}` is the
   accepted layout. ADR-045's `src/app/` line is refined away as a false abstraction
   for a dual-artifact repo.

4. **Deferred to a follow-up structural roadmap** (not 6.1 behavioral consolidation):
   - **`packages/` dual-tree collapse.** 308 tracked files still coexist with
     `src/domains/` and remain in CI (`packages/core/installer/**`,
     `packages/<PACK>/.agent-src.uncondensed/`). Step 10 ("move remaining packs")
     copied command surfaces but did not remove `packages/`. Completing the collapse
     is its own roadmap — it is bigger than Step 16 and touches the install/CI
     contract.
   - **`agents/` namespace + runtime-coupling resolution.** Resolve the
     maintainer-vs-consumer `agents/` collision and the settings-loader
     self-reference before any move; requires a pre-flight path test, not a
     bundled file move.

## Consequences

- **Positive.** Step 16 closes honestly: package source is structured under `src/`;
  root carries only essentials + the two tiers above, each with a stated reason.
- **Positive.** No high-blast-radius move (443-ref `agents/`, 117-ref `internal/`,
  plugin-pinned `hooks/`) is executed in an autonomous run, avoiding the kill-switch
  the roadmap warned about.
- **Negative / accepted.** The root is not reduced to the minimal inventory ADR-045
  diagrammed; the dual-artifact reality means workspace tooling stays at root by
  design. The acceptance criteria are amended to record this (see the roadmap).
- **Negative / accepted.** `packages/` still exists; the "root contains only
  essentials" goal is met *modulo* the documented dual-tree pending its own roadmap.

## Alternatives considered

- **Move `hooks/` under `src/` (the council's first-pass verdict).** Rejected on a
  fact the council lacked: the Claude plugin spec pins `hooks/hooks.json` to the
  plugin root. Moving it breaks consumer hook auto-discovery.
- **Move `internal/` + `agents/` under `src/` to satisfy ADR-045's diagram.**
  Rejected: violates the workspace-vs-package trust boundary and (for `agents/`)
  risks a self-referential runtime break; pure churn with negative value.
- **Keep Step 16 open until every dir moves.** Rejected: the remaining moves have
  design blockers, not effort gaps; closing with a documented boundary + a scoped
  follow-up is more honest than an open-ended step.

## References

- [`ADR-045`](ADR-045-src-source-layout-and-profiles-as-views.md) — `src/` source
  layout + profiles-as-views (refined here on the root inventory only).
- [`ADR-028`](ADR-028-root-layout.md) — earlier root-layout verdict (superseded by ADR-045).
- [`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/archive/road-to-6.0.0-d-structural-restructure.md) — Step 16 + amended acceptance criteria.
- AI council, design mode, 2026-06-05 (anthropic/claude-sonnet-4-5 + openai/gpt-4o) — converged on the trust-boundary closure.
