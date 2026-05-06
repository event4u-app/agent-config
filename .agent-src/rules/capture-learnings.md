---
type: "auto"
tier: "2a"
description: "After completing a task where a repeated mistake or successful pattern appeared — capture as rule or skill"
source: package
triggers:
  - phrase: "after completing a task"
  - keyword: "learning"
  - keyword: "lesson"
routes_to:
  - "skill:learning-to-rule-or-skill"
---

# Capture Learnings

**Iron Law.** After a task, capture repeated mistakes / successful patterns as a rule or skill — never lose the learning.

Body migrated to `skill:learning-to-rule-or-skill` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
