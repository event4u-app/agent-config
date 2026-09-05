---
model_tier: medium
name: fix
disable-model-invocation: true
argument-hint: "[ci|refs|portability|seeder|pr-comments|pr-comments-loop|comments|commit-messages|quality|route] [args]"
pack: engineering-base
intent: "Fix-workflow dispatcher — ci, pr-comments, pr-comments-loop, refs, seeder, portability, comments, commit-messages, quality"
routes_to: [fix-ci, fix-pr-comments, fix-pr-comments-loop, fix-refs, fix-seeder, fix-portability, fix-comments, fix-commit-messages, fix-quality, fix-route]
replaces: []
visibility: advanced
description: Fix orchestrator — routes to ci, references, portability, seeder, pr-comments, comments, quality
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
| `/fix pr-comments` | `commands/fix/pr-comments.md` | Fix and reply to all open review comments — **bot + human, classified per comment**; dedupes by comment id + reply marker |
| `/fix pr-comments-loop` | `commands/fix/pr-comments-loop.md` | Autonomous loop over `pr-comments` (auto mode): fix → commit+push → re-request Copilot review → wait — repeats until Copilot has no new comments; requires a PR URL |
| `/fix comments` | `commands/fix/comments.md` | Review the **code comments** in the current branch's diff and simplify, shorten, or remove each one (≠ `pr-comments`, which targets GitHub review threads) |
| `/fix commit-messages` | `commands/fix/commit-messages.md` | Measure the repo's commit convention, ask which style (custom always offered) and how far back, then rewrite past commit **subjects** to it — own commits by default, author identity preserved, backup tag + explicit rewrite/push gates |
| `/fix quality` | `commands/fix/quality.md` | Run the quality pipeline (type-checker / linter / formatter, PHP and/or JS/TS) and fix every error — auto-detects language from changed files |
| `/fix route` | `commands/fix/route.md` | Classify a vaguely-described problem and dispatch to the right fix sub (or name the specialist when it is not a fix task) — the `/smart-fix` front door, folded into the `fix` verb |

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
| Loop-until-clean review ask ("keep fixing until Copilot is happy", "loop the review fixes") + a PR URL | `fix/pr-comments-loop` | HIGH |
| Source-code comments are the target ("simplify/clean up the comments in my branch", "trim comment noise") | `fix/comments` | HIGH |
| Seeder / FK breakage named | `fix/seeder` | HIGH |
| Type-checker / linter / formatter errors in context ("fix the quality errors", PHPStan/tsc/eslint output) | `fix/quality` | HIGH |
| Past commit **messages** are the target ("clean up my commit messages", "make the history conventional") | `fix/commit-messages` | HIGH |
| Project-specific leakage in shared package named | `fix/portability` | MEDIUM |
| No clear signal, or ≥ 2 conflict | — | LOW → menu (interactive) / `ambiguous_routing` (CI) |

`fix/pr-comments` is the single PR-review-comment surface: it handles bot
and human comments in one pass — classifying each unanswered comment by
author type and applying the right detection + reply style (deduped by id +
reply marker). The former bot-only and developer-only variants were folded
into it and removed.

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
   > 6. pr-comments-loop — loop pr-comments + Copilot re-review until no new comments (needs PR URL)
   > 7. comments — simplify / shorten / remove code comments in the branch diff
   > 8. quality — run the quality pipeline and fix every error
   > 9. route — describe the problem; I classify and dispatch

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it. Sub-command rules override these defaults only when stated.
- **Do NOT chain sub-commands.** One `/fix <sub>` per turn.
- Auto-detection emits the structured pre-routing block before routing; on
  LOW confidence it shows the menu (interactive) or aborts (CI) — it
  **never** guesses past LOW.
