---
type: "auto"
tier: "2a"
description: "Git commit message format, branch naming, conventional commits, committing, pushing, or creating pull requests"
source: package
triggers:
  - keyword: "commit"
  - keyword: "branch"
  - phrase: "conventional commits"
routes_to:
  - "skill:conventional-commits-writing"
---

# Commit Conventions

**Iron Law.** Use Conventional Commits (`feat:`, `fix:`, `chore:` …); branches `<type>/<short-slug>`; never invent your own format.

Body migrated to `skill:conventional-commits-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
