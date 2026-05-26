---
adr: 019
status: accepted
date: 2026-05-23
decision: router-json-dist-location
supersedes: —
superseded_by: —
phase: v2.x · post-monorepo cleanup
type: retrospective
---

# ADR-019 — `router.json` relocated to `dist/router.json`

## Status

**Accepted** · 2026-05-23. Moves the compiled router-kernel artefact
from the repo root to `dist/router.json`, aligning it with the
existing `dist/discovery/` build-artefact slot established by
ADR-015.

Companion artefacts:
- Contract: [`docs/contracts/rule-router.md`](../contracts/rule-router.md)
- Compiler: [`scripts/compile_router.py`](../../scripts/compile_router.py)
- ADR-rule-kernel-and-router: [`ADR-rule-kernel-and-router.md`](ADR-rule-kernel-and-router.md)
- Tier ADR: [`docs/adrs/router/0001-three-tier-routing.md`](../adrs/router/0001-three-tier-routing.md)

## Context

`router.json` was emitted at the repo root by the original
kernel-and-router shipping (ADR-rule-kernel-and-router, P3.2). The
root location pre-dated the `dist/` convention; once
ADR-015 codified `dist/discovery/` as the build-artefact slot and
ADR-012 introduced `dist/cli/` for the TS shell, the router
artefact's root location became the outlier — visually equivalent
to hand-edited project files like `AGENTS.md` or
`.agent-settings.yml`, even though it is regenerated from rule
frontmatter on every `task compile-router` / `task sync` run.

The artefact is still a **public contract**: external host agents
(Claude.ai bundle, Skills API per
[`package-self-orientation`](../contracts/package-self-orientation.md))
read it once per session to resolve the always-loaded kernel and the
tier-1/2 routing tables. Moving it is therefore a one-time breaking
change for consumers — they update the read path or fail to resolve
rules at session start.

## Decision

**Compile to `dist/router.json` and ship the file tracked in git
under a `!/dist/router.json` allowlist exception.** `dist/` remains
gitignored; only the router artefact is committed.

Rationale:

1. **Slot consistency.** Build outputs live under `dist/`. Two
   pre-existing slots (`dist/discovery/`, `dist/cli/`) already
   commit selected artefacts via `.gitignore` allowlists. The
   router follows the same pattern.
2. **Thin-Root contract.** `AGENTS.md` and the repo root are
   pointer-heavy and human-curated; generated artefacts at the root
   create review noise on every regen.
3. **Single read path.** Host agents already read
   `dist/discovery/discovery-manifest.json`; adding the router to
   the same parent dir collapses the "where does the package emit
   its public contracts" answer to a single directory.

## Trade-offs accepted

- **Breaking change for consumers.** Pinned external readers (the
  Claude.ai bundle, any Skills API caller, third-party tooling
  reading the kernel) must update their read path from
  `<root>/router.json` to `<root>/dist/router.json`. No deprecation
  shim — the path is in the artefact body for one
  release window, surfaced via the changelog, and that is the
  contract update.
- **Allowlist drift risk.** A future `dist/` purge that forgets the
  `!/dist/router.json` line will silently regress the public
  contract. The `task release-prepare` and `task ci` runs both call
  `compile_router.py`, which re-creates the file before any
  packaging step that would notice its absence.

## Implementation footprint

- **Compiler / CLI.** `scripts/compile_router.py`,
  `scripts/lint_trust_coherence.py`, `scripts/_cli/cmd_explain.py`,
  `scripts/_cli/explain_last/route.py` — output path constants
  point at `dist/router.json`.
- **Smoke.** `scripts/smoke/kernel.sh`, `scripts/smoke/router.sh`
  read from the new path; `.github/workflows/smoke.yml` path-trigger
  globs updated via `docs/contracts/smoke-contracts.md`.
- **Tests.** `tests/test_lint_trust_coherence.py`,
  `tests/test_cmd_explain.py`, `tests/cli/explain_last/conftest.py`
  patch the new constants; `tests/test_one_liner_entrypoints.sh`
  stages `dist/router.json` (not the whole `dist/`, to avoid pulling
  in the TS-compiled CLI which needs `node_modules`).
- **`.gitignore`.** `/dist/` stays ignored; `!/dist/router.json`
  allowlist exception added.
- **Docs.** `AGENTS.md`, `docs/architecture.md`,
  `docs/customization.md`, `docs/contracts/{rule-router,
  namespace, trust-and-safety, smoke-contracts, kernel-membership}.md`,
  `docs/contracts/explain-trace.schema.json`,
  `docs/adrs/router/0001-three-tier-routing.md`,
  `docs/adrs/smoke/0001-per-tier-smoke-scripts.md`.
- **Source rules.** Uncondensed rule sources referencing the path
  (`telegraph-speak.md`, `git-history-discipline.md`) updated and
  re-projected.

## Reversal cost

Two-edit revert: move the file back, flip the constants, drop the
allowlist line. `git mv` history is preserved through the rename,
so a `git revert` of the commit suffices. The contract update would
be a second breaking change for any consumer that adopted the new
path — so reversal is **possible but expensive after first
external uptake**.

## References

- [`docs/contracts/rule-router.md`](../contracts/rule-router.md) — frontmatter + read-path contract.
- [`docs/contracts/kernel-membership.md`](../contracts/kernel-membership.md) — kernel cap.
- [`dist/router.json`](../../dist/router.json) — compiled output.
- [`scripts/compile_router.py`](../../scripts/compile_router.py) — compiler.
- [`ADR-015-discovery-manifest-contract.md`](ADR-015-discovery-manifest-contract.md) — precedent for `dist/` allowlist.
- [`ADR-rule-kernel-and-router.md`](ADR-rule-kernel-and-router.md) — original kernel-and-router decision.
