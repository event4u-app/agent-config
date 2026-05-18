---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Git history after a push — squash/amend/rebase of pushed commits must pair with immediate re-push in same turn; stop on divergent state"
source: package
triggers:
  - intent: "squash the pushed branch"
  - intent: "clean up commits on the PR branch"
  - intent: "tidy history after pushing"
  - keyword: "git rebase -i"
  - keyword: "--amend"
  - keyword: "force-push"
  - keyword: "--force-with-lease"
  - phrase: "branch diverged"
  - phrase: "pull --rebase failed"
  - phrase: "ahead and behind"
routes_to:
  - "skill:git-workflow"
---

# Post-Push Rewrite Discipline

## Iron Law

```
ONCE PUSHED, A COMMIT IS PUBLISHED.
ANY REWRITE OF PUSHED HISTORY MUST PAIR WITH AN IMMEDIATE RE-PUSH
IN THE SAME TURN — OR DON'T REWRITE.
NEVER END A SESSION WITH REWRITTEN-BUT-UNPUSHED LOCAL HISTORY.
```

## Two protective stops

1. **Pre-rewrite stop.** Before any squash / amend / rebase on a
   branch that is on origin: `git fetch && git rev-list --left-right
   --count HEAD...@{u}`. If **either** side is non-zero — STOP and
   route to `skill:git-workflow § Divergent-State Recovery`. A blind
   `git pull --rebase` in this state is the documented failure mode.

2. **Post-rewrite stop.** After the rewrite, push in the **same turn**
   with `--force-with-lease=<branch>:<fetched-sha>` and verify
   `git rev-parse origin/<branch>` equals `git rev-parse HEAD`.
   If the push fails (hook, network, token budget) — fix the cause
   and re-push **before** ending the session, committing new work,
   or handing off.

If either stop fires and resolution is not immediate → tag the state
(`git tag local-rewritten-tip-<ISO-date>`) and hand control back to
the user. Do not let a new session inherit a dirty divergence.

## Why this rule exists

A previous session squashed a pushed branch, the push hook failed at
the token boundary, the session ended — and the next session saw
local and origin pointing at different SHAs for the same logical work.
A blind `git pull --rebase` cascaded into conflicts across every
derived file (`.compression-hashes.json`, router projections). Recovery
required forensic SHA-archaeology. This rule makes that sequence
structurally impossible: rewrite without immediate push is forbidden.

## See also

- [`no-unsolicited-rebase`](no-unsolicited-rebase.md) — whether to
  rewrite at all (this rule kicks in once rewriting is authorized).
- [`skill:git-workflow`](../skills/git-workflow/SKILL.md) — Safe
  Squash-After-Push protocol and Divergent-State Recovery decision
  tree.
- [`commit-policy`](commit-policy.md) — never rewrite or commit
  without explicit authorization.
