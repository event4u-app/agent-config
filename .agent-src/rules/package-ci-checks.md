---
type: "auto"
tier: "mechanical-already"
description: "Before pushing to remote or creating a PR in the agent-config package — run all CI checks locally first"
source: package
triggers:
  - phrase: "task ci"
  - phrase: "before push"
  - phrase: "before pr"
routes_to:
  - "skill:lint-skills"
---

# Package Ci Checks

**Iron Law.** Run `task ci` locally and confirm green before pushing or opening a PR in this package.

Body migrated to `skill:lint-skills` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
