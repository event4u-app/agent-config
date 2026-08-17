---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Git history — no unasked rebase/squash/amend; never drop foreign commits; pushed rewrite → re-push same turn"
triggers:
  - keyword: "git rebase"
  - keyword: "rebase --onto"
  - keyword: "reset --hard"
  - keyword: "fixup"
  - keyword: "--amend"
  - keyword: "force-push"
  - keyword: "--force-with-lease"
  - keyword: "squash-merge"
  - phrase: "branch diverged"
  - phrase: "pull --rebase failed"
  - phrase: "ahead and behind"
  - phrase: "unexpected commits on the branch"
  - phrase: "commits I did not create"
routes_to:
  - "skill:git-workflow"
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "hook:block-no-verify"
# obligation: line 35
obligation_frequency: "per-commit"
---

# Git History Discipline

Fires on any rebase / squash / fixup / amend / force-push / `reset --hard` / squash-merge intent, on a divergent local↔origin state, or on a branch carrying commits you did not author this session.

## Iron Law — Gate (no unsolicited rewrites)

```
NEVER REBASE, SQUASH, FIXUP, OR AMEND PUBLISHED OR LOCAL HISTORY
WITHOUT THE USER ASKING FOR IT THIS TURN.
LINEAR HISTORY IS A PREFERENCE, NOT A DEFAULT.
COMMIT-CHUNK ORDER IS NOT A CORRECTNESS GOAL.
```

Add the next commit on top. Never reorder, fold, drop, or rewrite earlier
commits to make the log "look right".

## Iron Law — Protocol (once authorized)

```
ONCE PUSHED, A COMMIT IS PUBLISHED.
ANY REWRITE OF PUSHED HISTORY MUST PAIR WITH AN IMMEDIATE RE-PUSH
IN THE SAME TURN — OR DON'T REWRITE.
NEVER END A SESSION WITH REWRITTEN-BUT-UNPUSHED LOCAL HISTORY.
```

## Iron Law — Inherited & shared-branch commits (never drop without asking)

```
COMMITS YOU DID NOT AUTHOR THIS SESSION ARE NOT YOURS TO DROP.
NEVER EXCLUDE, RESET-AWAY, REBASE-OUT, OR FORCE-PUSH OVER A COMMIT
THAT ALREADY EXISTS ON A BRANCH (LOCAL OR REMOTE) — WITHOUT ASKING
THE USER THIS TURN. PARALLEL WORK IS THE DEFAULT, NOT THE EXCEPTION.
```

When in doubt about whether a commit is yours to touch: it is not. Ask.

## When rewrite is allowed

Exactly three:

1. **User says so this turn** — "rebase onto main", "squash these two", "amend that". This operation only, not a standing rule.
2. **Standing instruction not yet revoked** — the user said earlier in the conversation "always squash before pushing"; honor it.
3. **Conflict resolution forced by `git pull --rebase`** — the user already invoked the rebase via pull; finish it.

Anything else — chunk-tidiness, "logical order", folding a follow-up fix into its parent — **forbidden**. The follow-up ships as its own commit (`fix: …`, `chore: …`).

Body migrated to `skill:git-workflow` (per P4 of `road-to-kernel-and-router.md`) — shared-branch ask-before-drop protocol, two protective stops, forbidden-equivalents list, amend-after-hook-failure recovery, why-this-exists rationale, temptation catalog.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`scope-control`](scope-control.md) — git-ops permission gate ("rebase" already named in the canonical list).
- [`non-destructive-by-default`](non-destructive-by-default.md) — `reset --hard past unpushed work` and force-push are Hard-Floor triggers; the shared-branch Iron Law above is their commit-level companion.
- [`user-interaction`](user-interaction.md) — the one-question-per-turn shape for the shared-branch ask.
- [`commit-policy`](commit-policy.md) — commits are the user's call; rewriting them is a stronger version of the same restriction.
- [`token-efficiency`](token-efficiency.md) — Iron Law on burning the user's tokens for cosmetic gain.
- [`skill:git-workflow`](../skills/git-workflow/SKILL.md) — Safe Squash-After-Push protocol and Divergent-State Recovery decision tree.
- `git … --no-verify` / `core.hooksPath` overrides — deterministically blocked by the `block-no-verify` PreToolUse guard (`src/scripts/hooks/block_no_verify.ts`, registered in `hook_manifest.yaml`) **on the three hosts whose manifest row binds `pre_tool_use`** — augment, claude, cowork. On cursor, cline, windsurf, gemini and copilot the Iron Laws above are model-carried and "deterministically blocked" is not a claim this rule can make. Surfaced by the frequency join in `check_enforcement_coverage.ts`, which reports the per-commit obligation as uncovered on exactly those platforms. To check the host you are on rather than trusting this sentence, run `agent-config hooks:status`.

  **Corrected 2026-08-17 — still uncovered on those five, and the reason this rule gave was wrong for three of them.** The sentence read "the guard has nowhere to bind". The manifest's own `native_event_aliases` table refutes that for cursor, cline and gemini: it already maps `preToolUse`, `PreToolUse` and `BeforeTool` onto `pre_tool_use`. There the guard is **unbound, not unbindable** — nobody wrote the binding. Only windsurf and copilot carry no pre-tool surface at all. Whether those three hosts' pre-tool events can actually *deny* is recorded nowhere in this tree, so the opposite claim is unbacked too; the three states and what each rests on are tabulated once in [`hook-architecture-v1 § Which hosts carry pre_tool_use`](../../docs/contracts/hook-architecture-v1.md). This corrects the cause, not the coverage count.
