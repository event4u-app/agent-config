---
stability: beta
---

# Command-cluster contract

> **Status:** beta — locked for `1.15.0` Phase 1 (top-3 clusters).
> Phase 2 (remaining 12 clusters) waits one deprecation cycle.
> Source roadmap: [`agents/roadmaps/road-to-governance-cleanup.md`](../../agents/roadmaps/road-to-governance-cleanup.md)
> § F2.

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

## Phase 1 clusters (locked, ship in 1.15.0)

| Cluster | Sub-commands | Replaces |
|---|---|---|
| `fix` | `ci` · `pr` · `pr-bots` · `pr-developers` · `portability` · `refs` · `seeder` | `fix-ci` · `fix-pr-comments` · `fix-pr-bot-comments` · `fix-pr-developer-comments` · `fix-portability` · `fix-references` · `fix-seeder` |
| `optimize` | `agents` · `augmentignore` · `rtk` · `skills` | `optimize-agents` · `optimize-augmentignore` · `optimize-rtk-filters` · `optimize-skills` |
| `feature` | `explore` · `plan` · `refactor` · `roadmap` | `feature-explore` · `feature-plan` · `feature-refactor` · `feature-roadmap` |

**Net Phase 1:** 15 atomic commands → 3 cluster commands.

## Phase 2 clusters (deferred to next minor release)

Listed in `road-to-governance-cleanup.md` § Finding 2. Not yet locked
into the linter; new atomic commands matching these prefixes still
fail CI without a `cluster:` field once a Phase 2 entry is added
here.

- `chat-history` (`show` · `resume` · `clear` · `checkpoint`)
- `agents` (`audit` · `cleanup` · `prepare`)
- `memory` (`add` · `load` · `promote` · `propose`)
- `roadmap` (`create` · `execute`)
- `module` (`create` · `explore`)
- `tests` (`create` · `execute`)
- `context` (`create` · `refactor`)
- `override` (`create` · `manage`)
- `copilot-agents` (`init` · `optimize`)
- `commit` (flag: `--in-chunks`)
- `judge` (`solo` · `steps` · `on-diff`) + standalone `/review`
- `create-pr` (flag: `--description-only`)

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
not to retro-fit every legacy command into a Phase 1 cluster.

## Deprecation shim contract

A shim is a one-file stub that:

1. Keeps the old command slug in `.agent-src.uncompressed/commands/`.
2. Declares `superseded_by:` in frontmatter pointing to the new
   cluster command (e.g. `superseded_by: fix ci`).
3. Declares `deprecated_in:` with the release version (e.g.
   `deprecated_in: 1.15.0`).
4. Body contains exactly one warning line in the format:
   ```
   ⚠️  /<old-name> is deprecated; use /<cluster> <sub> instead.
   ```
5. Otherwise forwards verbatim to the cluster command (no logic).

`scripts/skill_linter.py` enforces the warning-line shape on any
file with `superseded_by:` set.

## Removal cycle

| State | Release |
|---|---|
| Cluster command shipped, shim active | `1.15.0` |
| Shim emits warning, both work | `1.15.x` (one minor cycle) |
| Shim removed, only cluster works | `1.16.0` |

No permanent aliases. Consumers who pin a 1.15 minor get a full
release window of warnings; the 1.16 release notes call out the
removal explicitly.

## Linter behavior

`scripts/lint_no_new_atomic_commands.py`:

- Reads the locked cluster names from this file (parsed from the
  Phase 1 table above).
- Finds every command file **added** since `--baseline`
  (default: `main`) — modifications to existing files are ignored.
- For each new file, requires `cluster:` to be set to one of the
  locked names — OR `superseded_by:` (the file is a shim).
- Exits non-zero on the first violation; lists every violator.

`--all` mode (manual audit only, not in CI) lints every command
file and surfaces grandfathered ones — useful when planning a
Phase 2 cluster expansion.

## See also

- [`agents/roadmaps/road-to-governance-cleanup.md`](../../agents/roadmaps/road-to-governance-cleanup.md) — F2 phased-collapse decision.
- [`agents/roadmaps/road-to-post-pr29-optimize.md`](../../agents/roadmaps/road-to-post-pr29-optimize.md) — P0.8 anchors this contract in 1.15.0.
- [`docs/migrations/commands-1.15.0.md`](../migrations/commands-1.15.0.md) — user-facing migration notes.
- [`docs/contracts/STABILITY.md`](STABILITY.md) — `beta` level rules apply.
