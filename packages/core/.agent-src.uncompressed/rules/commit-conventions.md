---
type: "auto"
tier: "2a"
description: "Git commit format, branch naming, conventional commits, committing, pushing, creating PRs"
source: package
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
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Commit Conventions

**Iron Law.** Use Conventional Commits (`feat:`, `fix:`, `chore:` …); branches `<type>/<short-slug>`; never invent your own format.

Body migrated to `skill:conventional-commits-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
