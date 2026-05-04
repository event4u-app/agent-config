---
stability: beta
---

# Command-cluster contract

> **Status:** beta — Phase 1 locked for `1.15.0` (top-3 clusters);
> Phase 2 locked for `1.17.0` (the remaining 12 clusters);
> Phase 3 locked for `1.17.0` (`council` cluster).
> Source roadmap: [`agents/roadmaps/road-to-structural-optimization.md`](../../agents/roadmaps/road-to-structural-optimization.md)
> § Phase 1 / § Phase 4 (which builds on `archive/road-to-governance-cleanup.md` § F2).

The agent-config command surface collapses related atomic commands
into **verb clusters**. A cluster is a single top-level command
(e.g. `/fix`) that dispatches to sub-commands (e.g. `/fix ci`,
`/fix pr`). Old atomic commands stay one release as deprecation
shims, then disappear.

This file is the **locked source of truth** for which clusters
exist and which sub-commands belong to each. The atomic-command
linter (`scripts/lint_no_new_atomic_commands.py`) reads this file;
new atomic commands without a `cluster:` field pointing to an
entry below fail CI.

## Locked clusters

The full set, both phases. Linter parses every backticked name in
column 1 of this table.

| Cluster | Phase | Sub-commands | Replaces |
|---|:-:|---|---|
| `fix` | 1 | `ci` · `pr` · `pr-bots` · `pr-developers` · `portability` · `refs` · `seeder` | `fix-ci` · `fix-pr-comments` · `fix-pr-bot-comments` · `fix-pr-developer-comments` · `fix-portability` · `fix-references` · `fix-seeder` |
| `optimize` | 1 | `agents` · `augmentignore` · `rtk` · `skills` | `optimize-agents` · `optimize-augmentignore` · `optimize-rtk-filters` · `optimize-skills` |
| `feature` | 1 | `explore` · `plan` · `refactor` · `roadmap` | `feature-explore` · `feature-plan` · `feature-refactor` · `feature-roadmap` |
| `chat-history` | 2 | `show` · `resume` · `clear` · `checkpoint` | `chat-history` (legacy status) · `chat-history-resume` · `chat-history-clear` · `chat-history-checkpoint` |
| `agents` | 2 | `audit` · `cleanup` · `prepare` | `agents-audit` · `agents-cleanup` · `agents-prepare` |
| `memory` | 2 | `add` · `load` · `promote` · `propose` | `memory-add` · `memory-full` · `memory-promote` · `propose-memory` |
| `roadmap` | 2 | `create` · `execute` | `roadmap-create` · `roadmap-execute` |
| `module` | 2 | `create` · `explore` | `module-create` · `module-explore` |
| `tests` | 2 | `create` · `execute` | `tests-create` · `tests-execute` |
| `context` | 2 | `create` · `refactor` | `context-create` · `context-refactor` |
| `override` | 2 | `create` · `manage` | `override-create` · `override-manage` |
| `copilot-agents` | 2 | `init` · `optimize` | `copilot-agents-init` · `copilot-agents-optimize` |
| `judge` | 2 | `solo` · `on-diff` · `steps` | `judge` (legacy standalone) · `do-and-judge` · `do-in-steps` |
| `commit` | 2 | flag: `--in-chunks` | `commit-in-chunks` |
| `create-pr` | 2 | flag: `--description-only` | `create-pr-description` |
| `council` | 3 | `default` · `pr` · `design` · `optimize` | `council` (legacy default lens) · `council-pr` · `council-design` · `council-optimize` |

**Net change:** Phase 1 collapsed 15 atomics → 3 clusters; Phase 2
collapses 26 atomics → 9 sub-command clusters + 2 flag-clusters
(`commit`, `create-pr`) that absorb their helper into a flag. The
standalone `/review` surface that mirrors `judge solo` lives at
[`commands/review-changes.md`](../../.agent-src.uncompressed/commands/review-changes.md).

## Frontmatter contract

A new command file under `.agent-src.uncompressed/commands/` MUST
declare `cluster:` in its frontmatter, pointing to one of the locked
clusters above:

```yaml
---
name: fix-ci          # legacy slug retained for the shim
cluster: fix          # required: locked cluster name
sub: ci               # required: sub-command identifier (kebab-case)
description: Fetch CI errors from GitHub Actions and fix them
---
```

The linter only flags **newly-added** files under `commands/`
(git status `A`). Pre-existing commands without `cluster:` are
grandfathered indefinitely; modifying them does NOT require adding
the field. The goal is to stop the atomic surface from growing,
not to retro-fit every legacy command into a cluster.

## Deprecation shim contract

A shim is a one-file stub that:

1. Keeps the old command slug in `.agent-src.uncompressed/commands/`.
2. Declares `superseded_by:` in frontmatter pointing to the new
   cluster command. Two valid shapes:
   - Sub-command form: `superseded_by: fix ci` (most clusters).
   - Flag form: `superseded_by: commit --in-chunks` (flag-clusters
     `commit`, `create-pr`).
3. Declares `deprecated_in:` with the release version (e.g.
   `deprecated_in: 1.15.0`).
4. Body contains exactly one warning line in the format:
   ```
   ⚠️  /<old-name> is deprecated; use /<cluster> <sub> instead.
   ```
   For flag-clusters, the second `/<cluster> <sub>` becomes
   `/<cluster> --<flag>`.
5. Otherwise forwards verbatim to the cluster command (no logic).

`scripts/skill_linter.py` enforces the warning-line shape on any
file with `superseded_by:` set.

## Removal cycle

| State | Phase 1 | Phase 2 |
|---|---|---|
| Cluster command shipped, shim active | `1.15.0` | `1.17.0` |
| Shim emits warning, both work | `1.15.x` / `1.16.x` (≥ one minor cycle) | `1.17.x` (one minor cycle) |
| Shim removed, only cluster works | `1.17.0` (Phase 1 atomics removed alongside Phase 2 lock-in) | next minor after `1.17.x` |

No permanent aliases. Consumers who pin a 1.17 minor get a full
release window of warnings; the next-minor release notes call out
the removal explicitly. The 1.17.0 release ships Phase 2 cluster
locks **and** drops the seven Phase 1 atomic shims at the end of
their deprecation cycle.

## Linter behavior

`scripts/lint_no_new_atomic_commands.py`:

- Reads the locked cluster names from this file (parsed from the
  "Locked clusters" table above — column 1 backticks).
- Finds every command file **added** since `--baseline`
  (default: `main`) — modifications to existing files are ignored.
- For each new file, requires `cluster:` to be set to one of the
  locked names — OR `superseded_by:` (the file is a shim).
- Exits non-zero on the first violation; lists every violator.

`--all` mode (manual audit only, not in CI) lints every command
file and surfaces grandfathered ones — useful when planning a
future cluster expansion.

`scripts/check_cluster_patterns.py` (Phase 2 onward):

- Compares each cluster dispatcher's structure against the Phase 1
  reference patterns (`commands/fix.md`, `commands/optimize.md`,
  `commands/feature.md`).
- Required sections: top-of-file `# /<cluster>`, `## Sub-commands`
  table with `Sub-command | Routes to | Purpose` columns, `## Dispatch`
  steps, `## Migration` notice, `## Rules` block.
- Fails CI if a new cluster invents a different dispatch shape.

## See also

- [`agents/roadmaps/road-to-structural-optimization.md`](../../agents/roadmaps/road-to-structural-optimization.md) — Phase 1 (Phase 2 cluster lock-in for 1.17.0).
- [`agents/roadmaps/archive/road-to-governance-cleanup.md`](../../agents/roadmaps/archive/road-to-governance-cleanup.md) — F2 phased-collapse decision.
- [`agents/roadmaps/road-to-post-pr29-optimize.md`](../../agents/roadmaps/road-to-post-pr29-optimize.md) — P0.8 anchors this contract in 1.15.0.
- [`docs/migrations/commands-1.15.0.md`](../migrations/commands-1.15.0.md) — user-facing migration notes.
- [`docs/contracts/STABILITY.md`](STABILITY.md) — `beta` level rules apply.
