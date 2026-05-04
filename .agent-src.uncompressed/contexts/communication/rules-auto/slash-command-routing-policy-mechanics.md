# Slash-command routing — cluster mechanics

Lookup table for the `slash-command-routing-policy` rule. Lists the
locked clusters and their sub-commands so the rule itself can stay at
its current LOC while still reflecting the full surface. Source of
truth for the cluster names is
[`docs/contracts/command-clusters.md`](../../../../docs/contracts/command-clusters.md);
this file mirrors that contract for runtime lookup. Linter:
`scripts/check_cluster_patterns.py` (verifies dispatcher shape).

## Locked clusters and sub-commands

| Cluster | Phase | Sub-commands | Replaces |
|---|:-:|---|---|
| `/fix` | 1 | `ci` · `pr` · `pr-bots` · `pr-developers` · `portability` · `refs` · `seeder` | `/fix-ci` · `/fix-pr-comments` · `/fix-pr-bot-comments` · `/fix-pr-developer-comments` · `/fix-portability` · `/fix-references` · `/fix-seeder` |
| `/optimize` | 1 | `agents` · `augmentignore` · `rtk` · `skills` | `/optimize-agents` · `/optimize-augmentignore` · `/optimize-rtk-filters` · `/optimize-skills` |
| `/feature` | 1 | `explore` · `plan` · `refactor` · `roadmap` | `/feature-explore` · `/feature-plan` · `/feature-refactor` · `/feature-roadmap` |
| `/chat-history` | 2 | `show` | `/chat-history` (legacy status) — `resume` / `clear` / `checkpoint` removed in `road-to-chat-history-hook-only` |
| `/agents` | 2 | `audit` · `cleanup` · `prepare` | `/agents-audit` · `/agents-cleanup` · `/agents-prepare` |
| `/memory` | 2 | `add` · `load` · `promote` · `propose` | `/memory-add` · `/memory-full` · `/memory-promote` · `/propose-memory` |
| `/roadmap` | 2 | `create` · `execute` | `/roadmap-create` · `/roadmap-execute` |
| `/module` | 2 | `create` · `explore` | `/module-create` · `/module-explore` |
| `/tests` | 2 | `create` · `execute` | `/tests-create` · `/tests-execute` |
| `/context` | 2 | `create` · `refactor` | `/context-create` · `/context-refactor` |
| `/override` | 2 | `create` · `manage` | `/override-create` · `/override-manage` |
| `/copilot-agents` | 2 | `init` · `optimize` | `/copilot-agents-init` · `/copilot-agents-optimize` |
| `/judge` | 2 | `solo` · `on-diff` · `steps` | `/judge` (legacy standalone) · `/do-and-judge` · `/do-in-steps` |
| `/commit` | 2 | flag: `--in-chunks` | `/commit:in-chunks` |
| `/create-pr` | 2 | flag: `--description-only` | `/create-pr:description-only` |

## Routing semantics

1. The user types `/<cluster> [<sub>] [args]`.
2. Match the cluster against the table above. If the leading token is
   a dispatcher cluster, route to the dispatcher's `commands/<cluster>.md`
   and let the dispatcher's "Dispatch" section pick the sub-command.
3. If the leading token is a flag-cluster (`/commit`, `/create-pr`),
   the cluster file is the entry point itself; flags absorb the
   former helper command.
4. **Legacy atomic shims** (`/fix-ci`, `/agents-audit`, …) keep working
   for one release cycle. They emit a deprecation warning and forward
   to the cluster invocation. New invocations should always use the
   cluster form.
5. If a sub-command is unknown, the dispatcher prints the menu — never
   guess.

## Removal cycle

| Cycle | Active form | Shim form |
|---|---|---|
| `1.15.x` / `1.16.x` | Phase 1 cluster commands | Phase 1 atomic shims |
| `1.17.0` | Phase 1 + Phase 2 cluster commands | Phase 2 atomic shims (Phase 1 atomics removed) |
| next minor after `1.17.x` | Cluster commands only | — (Phase 2 atomics removed) |

Consumers see the canonical surface as the cluster form throughout.
