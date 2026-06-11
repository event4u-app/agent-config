---
model_tier: medium
name: fix
disable-model-invocation: true
pack: engineering-base
intent: "Fix-workflow dispatcher — ci, pr-comments, refs, seeder, portability"
routes_to: [fix-ci, fix-pr-comments, fix-refs, fix-seeder, fix-portability]
replaces: []
tier: 1
description: Fix orchestrator — routes to ci, references, portability, seeder, pr-comments, pr-bot-comments, pr-developer-comments
cluster: fix
type: orchestrator
auto_detect: true
suggestion:
  eligible: true
  trigger_description: "fix CI, fix references, fix the broken seeder, fix PR comments, address bot review"
  trigger_context: "user wants to fix something that has a dedicated sub-command"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /fix

Top-level orchestrator for the `/fix` family. Replaces 7 standalone commands
with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/fix ci` | `commands/fix/ci.md` | Fetch CI errors from GitHub Actions and fix them |
| `/fix refs` | `commands/fix/refs.md` | Find and fix broken cross-references in `.augment/` and `agents/` |
| `/fix portability` | `commands/fix/portability.md` | Find and fix project-specific references in shared `.augment/` files |
| `/fix seeder` | `commands/fix/seeder.md` | Scan seeder data files for broken FK references |
| `/fix pr-comments` | `commands/fix/pr-comments.md` | Fix and reply to open review comments — **detects bot / human / both** and asks which when ambiguous; dedupes by comment id + reply marker |
| `/fix pr-bot-comments` | `commands/fix/pr-bot-comments.md` | **Deprecated → `fix pr-comments`** (the "bots" answer to its prompt) |
| `/fix pr-developer-comments` | `commands/fix/pr-developer-comments.md` | **Deprecated → `fix pr-comments`** (the "human" answer to its prompt) |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Non-interactive & auto-detection

`/fix` honors the [`non-interactive-contract`](../contexts/execution/non-interactive-contract.md)
(surface detection, confidence tiers, `--yes`/`--json`, abort schemas,
the `auto_detect` kill-switch, rollback). Detection table:

| Basis (signal) | Sub-command | Confidence |
|---|---|---|
| Explicit sub given (`/fix ci`) | that one | — (detection skipped) |
| CI run failing / "fix CI" / a CI log in context | `fix/ci` | HIGH |
| Broken cross-references named (`/fix refs`, ref-check output) | `fix/refs` | HIGH |
| PR review comments are the target (any "address review", PR # in context) | `fix/pr-comments` (it then resolves bot/human/both) | HIGH |
| Seeder / FK breakage named | `fix/seeder` | HIGH |
| Project-specific leakage in shared package named | `fix/portability` | MEDIUM |
| No clear signal, or ≥ 2 conflict | — | LOW → menu (interactive) / `ambiguous_routing` (CI) |

`fix/pr-comments` is the single PR-review-comment surface: it absorbs the
deprecated bot- and developer-only variants by detecting unanswered
comments and asking "fix bot / human / both?" (deduped by id + reply
marker). Auto-detection never routes to the deprecated variants.

## Dispatch

1. Parse the user's argument: `/fix <sub-command> [args]`.
2. **Explicit sub** → look it up and route. Otherwise run the detection
   table above per the non-interactive-contract.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. On **LOW** confidence (or `--no-auto-detect`): interactive → print the
   table and ask; non-interactive → emit `ambiguous_routing` and stop.

   > 1. ci — fetch and fix GitHub Actions errors
   > 2. refs — fix broken cross-refs in agent docs
   > 3. portability — purge project-specific refs from shared package
   > 4. seeder — scan seeders for broken FK references
   > 5. pr-comments — address open review comments (bot / human / both)

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it. Sub-command rules override these defaults only when stated.
- **Do NOT chain sub-commands.** One `/fix <sub>` per turn.
- Auto-detection emits the structured pre-routing block before routing; on
  LOW confidence it shows the menu (interactive) or aborts (CI) — it
  **never** guesses past LOW.
