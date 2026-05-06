---
type: "auto"
tier: "1"
description: "Any touch to agents/roadmaps/ — create/rename/delete/move, edit checkboxes ([x]/[~]/[-]), add/rename/remove phases — must regenerate dashboard and archive if 0 open items, same response"
source: package
triggers:
  - path_prefix: "agents/roadmaps/"
routes_to:
  - "guideline:agent-infra/roadmap-progress-mechanics"
---

# Roadmap Progress Sync

**Iron Law.** Any touch to `agents/roadmaps/` regenerates the dashboard in the same response; archive the roadmap when 0 open items remain.

Body migrated to `guideline:agent-infra/roadmap-progress-mechanics` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
