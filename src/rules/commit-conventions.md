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
workspaces:
  - engineering
packs:
  - engineering-base
---

# Commit Conventions

**Iron Law.** Use Conventional Commits (`feat:`, `fix:`, `chore:` …); branches `<type>/<short-slug>`; never invent your own format. Subjects + branch names stay emoji-free per [`no-decorative-emojis-in-git-surfaces`](no-decorative-emojis-in-git-surfaces.md); body emojis allowed only with an in-artifact legend.

Body migrated to `skill:conventional-commits-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
