---
complexity: lightweight
review_by: 2027-01-04
---

# Stub: road to governed worktree lifecycle

> **Stub — not active work.** Proposed in the 8.0.0/8.1.0 external review
> dumps: `/worktree:create|status|handoff|verify|merge-ready|cleanup`
> commands with branch naming, linked ticket, risk label, rollback note, and
> a merge-readiness score. Council 2026-07-08 (claude-sonnet-4-5 + gpt-4o):
> stub — zero demand signal today (no GitHub issues, no chat-log asks); the
> `using-git-worktrees` skill covers the current need.

## Promotion gates (all required)

1. **Demand signal:** ≥3 distinct users/sessions ask for governed worktree
   commands, or a real multi-worktree incident shows the skill-only approach
   losing work.
2. **Scope cut:** the command set is trimmed to what the demand actually
   names — do not build all six verbs speculatively.
3. **Overlap check:** confirm against `git-workflow` +
   `using-git-worktrees` + `finishing-a-development-branch` that the gap is
   orchestration (commands), not knowledge (skills).

## Seed content on promotion

- Command cluster under `src/agent-src/commands/worktree/`, one command per
  verb actually demanded; `scope-control` git-ops gates apply unchanged.
- Merge-readiness score = existing gates (CI green, review state), never a
  new invented metric.
