---
status: active
complexity: structural
parent_roadmap: road-to-6.0.0-d-structural-restructure
---

# Road to 6.0.x — Workspace structural cleanup (the deferred Step-16 remainder)

> Draft follow-up spun off when [`ADR-050`](../../docs/decisions/ADR-050-workspace-vs-package-root-boundary.md)
> closed Step 16 of [`road-to-6.0.0-d-structural-restructure`](archive/road-to-6.0.0-d-structural-restructure.md)
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

> **Council convergence** (claude-sonnet-4-5 + gpt-4o, 2026-06-05): destination =
> per-category `src/` roots (Option A, mirrors `src/skills`→`skills/`); use distinct
> names (`src/agent-templates/` ≠ existing `src/templates/`) **and** add a
> collision guard to `_root_specs()` (raise if two roots emit the same logical
> prefix); resolve the `profiles/` drift (`diff -qr`) as a pre-move blocker; stage
> as **1a** (move source + rewire generator, guarded by an empty-diff snapshot of
> the condensed `.agent-src/` tree before/after) then **1b** (delete `installer/`,
> repoint CI), with the `rm packages/` itself as Step 3. Decisive correctness gate:
> the condensed `.agent-src/` output is byte-identical after the move.

> **Status — 2026-06-05 (sub-phase 1a landed).** The uncondensed source container
> relocated `packages/core/.agent-src.uncondensed/` → `src/agent-src/` (~221 files),
> generator + 4 path-gates rewired, `.agent-src/` byte-identical, core pack manifest
> byte-stable. Recorded as
> [`ADR-051`](../../docs/decisions/ADR-051-uncondensed-source-container-relocation.md).
> **Blocker for Steps 2–3 (full `packages/` removal):** `packages/` is not just a
> leftover dual-tree — it hosts a **live pack-home / manifest layer** (`pack.yaml` +
> `README.md` + `FIRST_WIN.md` for 11 capability packs **not** in `src/domains/`),
> plus `core/installer/` (superseded by `src/cli`+`src/install`+`src/server`),
> `core/deploy/`, and `cloud/telemetry-worker/`. Deleting them would violate the
> acceptance criterion. **Where the 13 pack homes + installer + deploy + cloud worker
> migrate is an open design decision** → routed to a follow-up council session + its
> own staged PR (sub-phase 1b), per the Goal's "separate, never bundled" mandate.
> Steps 2–3 stay open pending that decision.

- [x] **Step 1:** Inventory what still lives only under `packages/` (not yet mirrored
  into `src/domains/` or the flat `src/skills/` + `src/rules/`): `packages/core/installer/`,
  per-pack `.agent-src.uncondensed/`, `pack.yaml` files, deploy artefacts. Produce a
  disposition table (move / already-mirrored / delete) per path.

  <!-- Step-1 disposition (308 tracked files under packages/). Source-of-truth
  finding: `packages/core/.agent-src.uncondensed/` is NOT a dead duplicate — it is
  the LIVE uncondensed source for every artefact category except skills/rules
  (already in src/skills, src/rules) and commands (already in src/domains).
  `_lib/agent_src.py::_root_specs()` still walks `packages/*/.agent-src.uncondensed/`.

  | packages/ path | files | disposition |
  |---|---|---|
  | core/.agent-src.uncondensed/contexts | 33 | MOVE → src/contexts (new logical-prefix root) |
  | core/.agent-src.uncondensed/personas | 31 | MOVE → src/personas |
  | core/.agent-src.uncondensed/templates | 138 | MOVE → src/agent-templates (prompt templates; distinct from the 16 workspace TS templates in src/templates) |
  | core/.agent-src.uncondensed/profiles | 7 | MOVE → src/profiles-src (verify vs existing src/profiles 7) |
  | core/.agent-src.uncondensed/presets | 4 | MOVE → src/presets |
  | core/.agent-src.uncondensed/user-types | 5 | MOVE → src/user-types |
  | core/.agent-src.uncondensed/ghostwriter | 2 | MOVE → src/ghostwriter (copy-as-is dir) |
  | core/.agent-src.uncondensed/scripts | 2 | MOVE → src/agent-templates-scripts or merge |
  | core/.agent-src.uncondensed/packs | 4 | MOVE → src/presets (install presets) |
  | core/.agent-src.uncondensed/commands | evals only | commands→src/domains already; keep evals |
  | core/.agent-src.uncondensed/README.md | 1 | drop (per-root readme) |
  | core/installer | 13 | DELETE — replaced by src/cli + src/install + src/server (taskfiles/dev.yml: "Replaces the v3 packages/core/installer"); repoint tests.yml |
  | core/deploy (Dockerfile, compose, README) | 3 | MOVE → src/deploy or deploy/ (referenced by docs/deploy/*, ADR-021) |
  | core/pack.yaml + README.md | 2 | resolve: core pack manifest |
  | pack-*/{pack.yaml,README,FIRST_WIN} | ~28 | resolve: pack manifests (11 packs); src/domains carries the NEW domain packs |
  | cloud/{telemetry-worker, README, pack.yaml} | 17 | resolve: cloud telemetry worker — likely MOVE → src/cloud or keep |

  DESTINATION DESIGN GATE (Phase-1, not in original roadmap): where do the ~221
  live uncondensed-source files go, and how is `_root_specs()` repointed? →
  routed to AI council before Step 2/3 execution. -->

- [x] **Step 2:** Repoint every CI + taskfile reference off `packages/` — notably
  `.github/workflows/tests.yml` (`packages/core/installer/**` working-directory +
  path filters), `taskfiles/ci-fast.yml` (`packages/<PACK>/.agent-src.uncondensed/`
  skill-linter path), and `migration-dry-run.yml` (`packages/**/*.md`). Each repoint
  is its own verifiable hunk.
- [x] **Step 3:** Remove `packages/` once nothing references it; re-run the Phase-0
  6.0-D gates (transitive hash, collision lint, pack-graph DAG) against the
  single-tree `src/domains/` layout. Update ADR-043 (monorepo-collapse) to record the
  collapse as *executed*, not just decided.

  <!-- Done in sub-phase 1b (ADR-052): 11 capability packs → src/packs/<id>/, core →
  src/packs/core/ (artefacts from the src/agent-src container), installer/python workspace
  modules → src/cli/python/, deploy/ → root deploy/, telemetry-worker → deploy/telemetry-worker/,
  cloud pack registration dropped, packages/ removed. Council-converged (Option B + tie-break),
  execution-refined core→src/packs/core to avoid condense-source pollution. Guards: .agent-src/
  byte-identical + per-pack manifest snapshot (manifests corrected from a pre-existing empty state).
  ADR-043 updated to record the collapse as executed. -->
- [x] **Step 3b (recovery):** Restored the `installer/python/` workspace runtime modules
  (`workspace_*`, `knowledge_ingest`) to `src/cli/python/` — they are live test+runtime deps, not
  part of the superseded TS installer; deleting them with the installer was an error caught by the
  full pytest suite and corrected before merge.

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

- [x] `packages/` no longer exists at repo root; no CI workflow or taskfile
  references it; Phase-0 gates green on the single `src/` tree. <!-- 1b / ADR-052 -->
- [ ] The maintainer `agents/` namespace decision is recorded as an ADR and the
  consumer-vs-maintainer collision named in ADR-050 is resolved. <!-- Phase 2 -->
- [ ] `_lib/agent_settings.py` survives a settings-file relocation (pre-flight test
  proves the loader resolves the new path with the old absent).
- [ ] `task ci` green end-to-end after each phase; no skill/rule/command deleted
  beyond the `packages/` duplicates proven already-mirrored into `src/`.
