---
name: fix
description: Fix orchestrator — routes to ci, references, portability, seeder, pr-comments, pr-bot-comments, pr-developer-comments
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "fix CI, fix references, fix the broken seeder, fix PR comments, address bot review"
  trigger_context: "user wants to fix something that has a dedicated sub-command"
---

# /fix

Top-level orchestrator for the `/fix` family. Replaces 7 standalone commands
with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/fix ci` | `fix-ci.md` | Fetch CI errors from GitHub Actions and fix them |
| `/fix references` | `fix-references.md` | Find and fix broken cross-references in `.augment/` and `agents/` |
| `/fix portability` | `fix-portability.md` | Find and fix project-specific references in shared `.augment/` files |
| `/fix seeder` | `fix-seeder.md` | Scan seeder data files for broken FK references |
| `/fix pr-comments` | `fix-pr-comments.md` | Fix and reply to **all** open review comments (bots + humans) |
| `/fix pr-bot-comments` | `fix-pr-bot-comments.md` | Fix and reply to **bot** review comments only |
| `/fix pr-developer-comments` | `fix-pr-developer-comments.md` | Fix and reply to **human** reviewer comments only |

## Dispatch

1. Parse the user's argument: `/fix <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/fix-<sub>.md` file and follow
   its `## Instructions` section verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. ci — fetch and fix GitHub Actions errors
   > 2. references — fix broken cross-refs in agent docs
   > 3. portability — purge project-specific refs from shared package
   > 4. seeder — scan seeders for broken FK references
   > 5. pr-comments — address all open review comments
   > 6. pr-bot-comments — address bot reviewer comments only
   > 7. pr-developer-comments — address human reviewer comments only

## Migration

The 7 standalone `/fix-*` commands continue to work for one release cycle as
deprecation shims. They emit a notice and route to the same content. New
invocations should use `/fix <sub>`.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it. Sub-command rules override these defaults only when stated.
- **Do NOT chain sub-commands.** One `/fix <sub>` per turn.
- If the user invokes `/fix` with no argument, **show the menu** — do not
  guess which sub-command they meant.
