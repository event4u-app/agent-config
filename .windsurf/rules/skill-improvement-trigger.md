---
trigger: model_decision
description: After completing a meaningful task — trigger post-task learning capture if pipelines.skill_improvement is enabled
globs: 
---

# Skill Improvement Trigger

**Iron Law.** After a meaningful task, trigger the post-task learning capture if `pipelines.skill_improvement` is enabled.

Body migrated to `skill:skill-improvement-pipeline` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
