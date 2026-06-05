---
adr: 052
status: accepted
date: 2026-06-05
decision: packages-removal-and-pack-home-migration
supersedes: —
superseded_by: —
phase: v6.0.x · workspace structural cleanup · Phase 1 sub-phase 1b
type: structural
---

# ADR-052 — Remove `packages/`; migrate pack homes to `src/packs/` + ops dirs to `deploy/`

## Status

**Accepted** · 2026-06-05. Completes Phase 1 (Steps 2–3) of
[`road-to-6.0.x-workspace-structural-cleanup`](../../agents/roadmaps/road-to-6.0.x-workspace-structural-cleanup.md);
builds on [`ADR-051`](ADR-051-uncondensed-source-container-relocation.md) (sub-phase 1a) and executes
[`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md)'s collapse. Routed through the AI council
(`claude-sonnet-4-5` + `gpt-4o`, 2026-06-05, two rounds incl. a tie-break).

## Context

After 1a relocated the uncondensed artefact source to `src/agent-src/`, the remaining `packages/`
content was **not** dead duplication:

- **11 manifest-only capability packs** (`pack-finance-*`, `pack-gtm-sales`, `pack-founder-strategy`,
  `pack-ops-people`, `pack-{php,python,react,symfony,typescript,nextjs}`) — `pack.yaml` + `README.md`
  (+ some `FIRST_WIN.md`); 0 commands; artefacts are flat `src/skills`/`src/rules` grouped by
  frontmatter `packs:`. (Their old manifests were silently **empty** — `artefact_count: 0` — because
  the generator rglob'd a non-existent `.agent-src.uncondensed/` under each.)
- **`packages/core/`** — pack manifest + `installer/` + `deploy/`.
- **`packages/cloud/`** — a vestigial `pack.yaml`/`README` + a Cloudflare `telemetry-worker/`.

## Decision

| Item | Destination | Mode |
|---|---|---|
| 11 capability packs | `src/packs/<id>/` | `flat` (frontmatter `packs:`) |
| `core` pack | `src/packs/core/` manifest; artefacts collected from the full `src/agent-src/` container | `core` |
| `installer/python/` workspace modules (8 `.py`) | `src/cli/python/` | runtime |
| `installer/` (TS entry, package.json) | **deleted** (superseded by `src/cli`+`src/install`+`src/server`) | — |
| `deploy/` (Dockerfile, compose) | root `deploy/` | build artefact |
| `cloud/telemetry-worker/` | root `deploy/telemetry-worker/` | deployable |
| `cloud` pack registration | **dropped** (a deployable is not an installable pack) | — |

`generate_pack_manifests._pack_homes()` now resolves homes from `src/packs/` + `src/domains/`
(+ legacy `packages/` for back-compat), with a 3-way collection mode (`core` / `flat` / `physical`).
The pack subsystem (`validate_pack_yaml`, `lint_pack_dependencies`, `lint_pack_first_win`,
`check_release_pr_shape`, `release.py`) was repointed off `packages/*`.

### Council convergence and the execution refinements

Round 1 converged on `src/packs/<id>/` for the 11 packs (Option B) — **not** `src/domains/`, to avoid
the *activation-gate inversion* (a command-less domain home would let a downstream installer that
greps for `command.md` silently skip the pack). The tie-break round resolved **core → `src/agent-src/`**
(home == artefact root). Execution **refined core to `src/packs/core/`** instead, because
`src/agent-src/` is a **condense source root** (prefix `""`) — a `pack.yaml`/`README.md` placed there
would leak into the condensed `.agent-src/` output (the README would overwrite the real source README
once `packages/` was gone). The silent-data-loss risk that drove the council to `src/agent-src/` does
**not** apply: `_collect_core()` rglobs the *entire* `src/agent-src/` container (no whitelist), so a
future category is auto-included.

## Consequences

- `packages/` no longer exists at repo root; `package.json files:` never shipped it, so the published
  package is unaffected.
- Condensed `.agent-src/` output stays **byte-identical** (1a's snapshot guard, re-verified).
- The 11 capability-pack manifests now list their **real** artefacts (previously empty) — a correction,
  surfaced by the per-pack manifest snapshot guard, not silent drift.
- The `installer/python/` workspace modules (`workspace_*`, `knowledge_ingest`) — live runtime + test
  dependencies, **not** part of the superseded TS installer — were preserved at `src/cli/python/`.

## Alternatives considered

- **Pack homes under `src/domains/`** — rejected (activation-gate inversion).
- **core manifest at `src/agent-src/`** (tie-break winner) — rejected at execution (condense-source
  pollution).
- **Keeping `packages/` as a thin shim** — rejected; the roadmap goal is its removal, and nothing in
  `files:` or the build depends on it.

## References

- [`road-to-6.0.x-workspace-structural-cleanup`](../../agents/roadmaps/road-to-6.0.x-workspace-structural-cleanup.md)
- [`ADR-051`](ADR-051-uncondensed-source-container-relocation.md) · [`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md)
- `src/scripts/generate_pack_manifests.py` — `_pack_homes()`, `_collect_core()`.
