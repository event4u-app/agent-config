# Slash-command routing — cluster mechanics

Lookup table for the `slash-command-routing-policy` rule. Lists the
locked clusters and their sub-commands so the rule itself can stay at
its current LOC while still reflecting the full surface. Source of
truth for the cluster names is
[`docs/contracts/command-clusters.md`](../../../../../../docs/contracts/command-clusters.md);
this file mirrors that contract for runtime lookup. Linter:
`scripts/check_cluster_patterns.py` (verifies dispatcher shape).

## Locked clusters and sub-commands

| Cluster | Phase | Sub-commands | Replaces                                                                                                                                        |
|---|:-:|---|-------------------------------------------------------------------------------------------------------------------------------------------------|
| `/fix` | 1 | `ci` · `pr` · `pr-bots` · `pr-developers` · `portability` · `refs` · `seeder` | `/fix-ci` · `/fix-pr-comments` · `/fix-pr-bot-comments` · `/fix-pr-developer-comments` · `/fix-portability` · `/fix-references` · `/fix-seeder` |
| `/optimize` | 1 | `agents` · `augmentignore` · `rtk` · `skills` | `/optimize-agents` · `/optimize-augmentignore` · `/optimize-rtk-filters` · `/optimize-skills`                                                   |
| `/feature` | 1 | `explore` · `plan` · `refactor` · `roadmap` | `/feature-explore` · `/feature-plan` · `/feature-refactor` · `/feature-roadmap`                                                                 |
| `/chat-history` | 2 | `show` | `/chat-history` (legacy status) — `resume` / `clear` / `checkpoint` removed in `road-to-chat-history-hook-only`                                 |
| `/agents` | 2 | `init` · `optimize` · `audit` | `/copilot-agents-init` · merger of `/optimize-agents-md` + `/copilot-agents-optimize` · `/optimize-agents` (folder ops moved to `/optimize:agents-dir`) |
| `/memory` | 2 | `add` · `load` · `promote` · `propose` | `/memory-add` · `/memory-full` · `/memory-promote` · `/propose-memory`                                                                          |
| `/roadmap` | 2 | `create` · `process-step` · `process-phase` · `process-full` | `/roadmap-create` · `/roadmap-process` (replaced — autonomous, no per-step gate; `process-phase` is the default execution scope)                |
| `/module` | 2 | `create` · `explore` | `/module-create` · `/module-explore`                                                                                                            |
| `/tests` | 2 | `create` · `execute` | `/tests-create` · `/tests-execute`                                                                                                              |
| `/context` | 2 | `create` · `refactor` | `/context-create` · `/context-refactor`                                                                                                         |
| `/override` | 2 | `create` · `manage` | `/override-create` · `/override-manage`                                                                                                         |
| `/judge` | 2 | `solo` · `on-diff` · `steps` | `/judge` (legacy standalone) · `/do-and-judge` · `/do-in-steps`                                                                                 |
| `/commit` | 2 | flag: `--in-chunks` | `/commit:in-chunks`                                                                                                                             |
| `/create-pr` | 2 | flag: `--description-only` | `/create-pr:description-only`                                                                                                                   |

## Routing semantics

1. The user invokes a cluster sub-command in **one of two equivalent
   forms**:
   - `/<cluster>:<sub> [args]` — **canonical**. Single token, plays
     well with shell autocompletion and the slash-command picker.
   - `/<cluster> <sub> [args]` — **space-separated equivalent**.
     Identical semantics. Accept everywhere.

   Both forms route to the **same file** and the **same dispatcher**.
   Implementations MUST treat `:` and `<space>` as interchangeable
   delimiters at the cluster boundary. Autocompletion-aware UIs
   (Claude.ai picker, IDE slash-menus, shell completers) should
   surface the `:` form because it stays a single token.

2. Match the cluster against the table above. If the leading token is
   a dispatcher cluster, route to the dispatcher's `commands/<cluster>.md`
   and let the dispatcher's "Dispatch" section pick the sub-command.

3. If the leading token is a flag-cluster (`/commit`, `/create-pr`),
   the cluster file is the entry point itself; flags absorb the
   former helper command.

4. **Legacy atomic shims** (`/fix-ci`, `/agents-audit`, …) keep working
   for one release cycle. They emit a deprecation warning and forward
   to the cluster invocation. New invocations should always use the
   cluster form. **`/roadmap-execute` is removed** — invocations route
   to `/roadmap:process-phase` (default execution scope) with a
   one-time migration notice. Legacy `/roadmap-process[:<sub>]`
   invocations (the short-lived top-level cluster) likewise forward
   to `/roadmap:process-<sub>`.

5. If a sub-command is unknown, the dispatcher prints the menu — never
   guess.

## Why colon is canonical

Locked by [ADR-003](../../../../docs/decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md)
(2026-05-07) alongside the flat-cluster + composite-sub-name shape.

- **Single token in autocompleters.** `roadmap:process-phase` completes
  as one piece; `roadmap process-phase` requires the picker to
  re-prompt after the space.
- **Stable in chat history and logs.** Greppable as one string.
- **Unambiguous against free-text args.** `/roadmap:process-phase
  road-to-X.md` parses cleanly; the picker never confuses the sub
  with the first argument.
- **Symmetric across the catalog.** `/commit:in-chunks` and
  `/create-pr:description-only` already use this form; cluster
  dispatchers gain it without regressing the space form.

## Removal cycle

| Cycle | Active form | Shim form |
|---|---|---|
| `1.15.x` / `1.16.x` | Phase 1 cluster commands | Phase 1 atomic shims |
| `1.17.0` | Phase 1 + Phase 2 cluster commands | Phase 2 atomic shims (Phase 1 atomics removed) |
| next minor after `1.17.x` | Cluster commands only | — (Phase 2 atomics removed) |

Consumers see the canonical surface as the cluster form throughout.
