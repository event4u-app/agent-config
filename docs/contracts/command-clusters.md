---
stability: beta
---

# Command-cluster contract

> **Status:** beta — Phase 1 locked for `1.15.0` (top-3 clusters);
> Phase 2 locked for `1.17.0` (the remaining 12 clusters);
> Phase 3 locked for `1.17.0` (`council` cluster).

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
| `feature` | 1 | `explore` · `plan` · `refactor` · `roadmap` · `dev` | `feature-explore` · `feature-plan` · `feature-refactor` · `feature-roadmap` · `feature-dev` |
| `chat-history` | 2 | `show` · `import` · `learn` | `chat-history` (legacy status) — `resume` / `clear` / `checkpoint` removed in `road-to-chat-history-hook-only` (auto-adopt + structural hooks); `import` (verbatim cross-session render) and `learn` (project-improving learning extraction) added in the v4 stateless schema |
| `agents` | 2 | `audit` · `cleanup` · `prepare` | `agents-audit` · `agents-cleanup` · `agents-prepare` |
| `memory` | 2 | `add` · `load` · `promote` · `propose` | `memory-add` · `memory-full` · `memory-promote` · `propose-memory` |
| `roadmap` | 2 | `create` · `ai-council` · `process-step` · `process-phase` · `process-full` | `roadmap-create` · `roadmap-execute` (replaced — autonomous, no per-step gate; `process-phase` is the default execution scope); `ai-council` added 2026-05-07 — wraps `/council default` with `--input-mode roadmap --depth deep` |
| `module` | 2 | `create` · `explore` | `module-create` · `module-explore` |
| `tests` | 2 | `create` · `execute` | `tests-create` · `tests-execute` |
| `context` | 2 | `create` · `refactor` | `context-create` · `context-refactor` |
| `override` | 2 | `create` · `manage` | `override-create` · `override-manage` |
| `copilot-agents` | 2 | `init` · `optimize` | `copilot-agents-init` · `copilot-agents-optimize` |
| `judge` | 2 | `solo` · `on-diff` · `steps` | `judge` (legacy standalone) · `do-and-judge` · `do-in-steps` |
| `commit` | 2 | `in-chunks` | `commit-in-chunks` |
| `create-pr` | 2 | `description-only` | `create-pr-description` |
| `council` | 3 | `default` · `pr` · `design` · `optimize` | `council` (legacy default lens) · `council-pr` · `council-design` · `council-optimize` |
| `challenge-me` | — | `vision` · `with-docs` | new — Pocock-inspired one-question-at-a-time interview; `vision` is the standard 95%-confidence variant, `with-docs` adds doc/glossary awareness with a session-scoped glossary and load-bearing claim-vs-code verification |
| `research` | — | (cluster head only · follow-up phases will add `deep` · `add-items` · `add-fields`) | new — preliminary-research scaffolder ported from `Weizhena/Deep-Research-skills`; emits `outline.yaml` + `fields.yaml` against the `research-schema` contract. Deep-research and incremental-edit sub-commands are queued as follow-up ports. |

**Net change:** Phase 1 collapsed 15 atomics → 3 clusters; Phase 2
collapses 26 atomics → 11 sub-command clusters. Sub-commands use
colon syntax (`/cluster:sub`) so Claude Code's command palette can
autocomplete them. The standalone `/review` surface that mirrors
`judge solo` lives at
[`commands/review-changes.md`](../../.agent-src.uncompressed/commands/review-changes.md).

## Cluster depth and sub-command naming

Locked by [ADR-003](../decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md)
(2026-05-07). The shape is the default for **every** new cluster and
every new sub-command added to an existing cluster.

1. **Flat only.** A cluster has exactly one level of sub-commands.
   No sub-sub-commands. A dispatcher routes `/cluster <sub>` to a
   single sub-file; sub-files do not dispatch further. Two-level
   dispatch is a deliberate contract change requiring a new ADR
   superseding ADR-003.

2. **Composite sub-names for verb+scope.** When a cluster carries
   multiple verbs (e.g. authoring + execution), encode the verb in
   the sub-name, joined with `-`:

   - ✅ `/roadmap:create` · `/roadmap:process-step` ·
     `/roadmap:process-phase` · `/roadmap:process-full`
   - ❌ `/roadmap:process:phase` (sub-sub — forbidden)
   - ❌ `/roadmap:step` · `/roadmap:phase` · `/roadmap:full`
     (verb hidden — breaks symmetry with `create`)
   - ❌ separate `/roadmap-process` cluster (domain split — forbidden
     when one cluster can carry both verbs flat)

   Sibling sub-names stay in the same shape: either all bare verbs,
   all bare nouns/scopes, or all composite. Mixing bare and composite
   in the same cluster is allowed only when the bare sibling is the
   cluster's primary verb (e.g. `/roadmap:create` + `process-*`
   composites).

3. **Sub-name format.** kebab-case (`pr-bots`, `process-phase`),
   ≤ 24 chars, no leading verb that duplicates the cluster name
   (use `/fix:ci`, not `/fix:fix-ci`).

4. **Colon-canonical invocation.**
   `/<cluster>:<sub>` is the canonical form everywhere — catalog,
   docs, examples, deprecation warnings. The space-separated form
   `/<cluster> <sub>` is a first-class equivalent and routes to the
   same dispatcher; it must keep working. Autocompletion-aware UIs
   surface the colon form because it stays a single token. Full
   semantics: [`slash-command-routing-policy-mechanics.md`](../../.agent-src.uncompressed/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md)
   § Routing semantics.

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

- [`docs/migrations/commands-1.15.0.md`](../migrations/commands-1.15.0.md) — user-facing migration notes.
- [`docs/contracts/STABILITY.md`](STABILITY.md) — `beta` level rules apply.
