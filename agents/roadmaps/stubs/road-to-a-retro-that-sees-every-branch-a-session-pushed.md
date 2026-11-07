---
complexity: lightweight
review_by: 2027-02-28
---

# Stub: road to a retro that sees every branch a session pushed

> **Stub — not active work.** Raised by a `/retro --session` on 2026-11-07 whose
> triage could not see the session it was examining. `retro record` refuses a
> `skip:low-signal` unit by design, so the finding has no other place to land.

**The defect.** Retro session facts carry exactly one branch per session:
`src/scripts/retro_session_facts.ts:209` reads `pointer.branch`, and
`sessionPr` (`:99`, called at `:215`) looks up one PR for that one branch. A
session that does its work in its own worktree — which the session-register
collision protocol tells it to do — and pushes several PR branches from there is
measured by the branch its starting worktree happens to be on.

**The case.** The session of 2026-11-07 merged four PRs (#2897, #2902, #2904,
plus #2898 merged by the owner) from four branches in
`.claude/worktrees/commit-subjects-merge-group`, and blocked `main` for about
four hours through a ruleset change. Its retro read branch
`feat/road-to-a-link-with-agent-switch` (the main worktree's), reported
`no push of feat/road-to-a-link-with-agent-switch was recorded with a PR`, and
triaged `skip:low-signal`, score 0.

**Counter-hypothesis.** The session pointer was stale or named a different
session, and one branch per session is adequate when the pointer records the
branch actually pushed.

**Falsifier — promotion is due when it is checked, either way.** Run a session
that pushes two or more PR branches from a separate worktree, then
`./scripts-run src/scripts/retro --session`. All of those PRs in its facts and a
triage other than `skip:low-signal` refutes the defect; one branch and no PR
confirms it.

**What it settles, once confirmed:** whether the session pointer records every
branch the session pushed (from the push markers already written per push) and
`pr` becomes a list, and whether the triage weighs work outside the repository
tree — a ruleset write leaves no PR fact at all.
