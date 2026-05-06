---
type: "auto"
tier: "2a"
description: "When suggesting reviewers for a change — anchor the choice in paths and risk, never prestige or seniority; require primary + secondary role for medium/high risk"
source: package
triggers:
  - keyword: "reviewer"
  - phrase: "suggest reviewers"
routes_to:
  - "skill:review-routing"
---

# Reviewer Awareness

**Iron Law.** Anchor reviewer choice in paths and risk, never seniority; medium / high risk requires primary + secondary role.

Body migrated to `skill:review-routing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
