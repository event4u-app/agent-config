---
status: draft
complexity: structural
parent_roadmap: road-to-6.0.0-d-structural-restructure
---

# Road to 6.0.x — Workspace structural cleanup (the deferred Step-16 remainder)

> Draft follow-up spun off when [`ADR-050`](../../docs/decisions/ADR-050-workspace-vs-package-root-boundary.md)
> closed Step 16 of [`road-to-6.0.0-d-structural-restructure`](road-to-6.0.0-d-structural-restructure.md)
> as "structurally complete with a documented trust boundary". Two structural
> remainders were deferred out of the autonomous 6.0-D closure because each carries
> a real design blocker, not an effort gap, and each is the kind of high-blast-radius
> move the 6.0-D scope-line rule routes to a staged, own-PR lane:
>
> 1. **`packages/` dual-tree collapse** — Step 10 copied command surfaces into
>    `src/domains/` but never removed `packages/` (308 tracked files, still in CI).
> 2. **`agents/` namespace + runtime-coupling resolution** — the maintainer `agents/`
>    workspace (443 refs) collides conceptually with the consumer-facing `agents/`
>    convention the package ships, and the gitignored `.agent-settings.yml` (in
>    `agents/settings/`) is read at runtime by `_lib/agent_settings.py`, so a naive
>    move is self-referential.
>
> Draft until the 6.0-D closure PR merges and the maintainer greenlights sequencing.
> Behavioral consolidation stays in [`road-to-6.1.0-product-consolidation`](road-to-6.1.0-product-consolidation.md);
> this roadmap is structural only.

## Goal

`packages/` no longer exists at root (its content fully resolved into `src/domains/`
or deleted), and the maintainer workspace's `agents/`-namespace collision + settings
self-reference are resolved with a pre-flight path test — both shipped as their own
staged PRs, CI-localisable, never bundled.

## Phase 1: Complete the `packages/` dual-tree collapse (finish Step 10)

- [ ] **Step 1:** Inventory what still lives only under `packages/` (not yet mirrored
  into `src/domains/` or the flat `src/skills/` + `src/rules/`): `packages/core/installer/`,
  per-pack `.agent-src.uncondensed/`, `pack.yaml` files, deploy artefacts. Produce a
  disposition table (move / already-mirrored / delete) per path.
- [ ] **Step 2:** Repoint every CI + taskfile reference off `packages/` — notably
  `.github/workflows/tests.yml` (`packages/core/installer/**` working-directory +
  path filters), `taskfiles/ci-fast.yml` (`packages/<PACK>/.agent-src.uncondensed/`
  skill-linter path), and `migration-dry-run.yml` (`packages/**/*.md`). Each repoint
  is its own verifiable hunk.
- [ ] **Step 3:** Remove `packages/` once nothing references it; re-run the Phase-0
  6.0-D gates (transitive hash, collision lint, pack-graph DAG) against the
  single-tree `src/domains/` layout. Update ADR-043 (monorepo-collapse) to record the
  collapse as *executed*, not just decided.

## Phase 2: Resolve the `agents/` namespace + runtime coupling

- [ ] **Step 4:** *Design gate.* Decide the maintainer-workspace home: rename
  (`agents/` → `.agents/` or `internal/agents/`), keep-at-root-with-explicit-marker,
  or relocate contents to typed homes (roadmaps, settings, runtime). Record the call
  as an ADR. This MUST resolve the consumer-vs-maintainer `agents/` collision named
  in ADR-050.
- [ ] **Step 5:** Make `_lib/agent_settings.py` path-agnostic enough that moving the
  settings file cannot self-brick the loader mid-move (resolve-from-env or
  search-upward), with a pre-flight test that runs the loader against the NEW path
  with the OLD path absent. No file move ships before this test is green.
- [ ] **Step 6:** Execute the chosen disposition in its own PR; repoint the 443 refs
  in measured hunks; re-run the full path audit (the Step-19 surface) on the result.

## Acceptance Criteria

- [ ] `packages/` no longer exists at repo root; no CI workflow or taskfile
  references it; Phase-0 gates green on the single `src/domains/` tree.
- [ ] The maintainer `agents/` namespace decision is recorded as an ADR and the
  consumer-vs-maintainer collision named in ADR-050 is resolved.
- [ ] `_lib/agent_settings.py` survives a settings-file relocation (pre-flight test
  proves the loader resolves the new path with the old absent).
- [ ] `task ci` green end-to-end after each phase; no skill/rule/command deleted
  beyond the `packages/` duplicates proven already-mirrored into `src/`.
