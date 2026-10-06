---
type: "auto"
tier: "2a"
description: "Git commit format, branch naming, conventional commits, committing, pushing, creating PRs"
triggers:
  - keyword: "commit"
  - keyword: "branch"
  - phrase: "conventional commits"
routes_to:
  - "skill:conventional-commits-writing"
workspaces: [engineering]
packs: [engineering-base]
collision_ok:
  "commit": "format floor for every commit message"
# obligation: line 19
obligation_frequency: "per-commit"
---

# Commit Conventions

**Iron Law.** Match, in order, the repo's configured convention, a declared `git.commit_format: ticket-prefix`, or an approved measured one; else Conventional Commits (`feat:`, `fix:` …), with branches per `git.branch_pattern` (default `<type>/<short-slug>`); never invent one. Subjects + branch names stay emoji-free per [`no-decorative-emojis-in-git-surfaces`](no-decorative-emojis-in-git-surfaces.md); body emojis need an in-artifact legend.

Body migrated to `skill:conventional-commits-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
