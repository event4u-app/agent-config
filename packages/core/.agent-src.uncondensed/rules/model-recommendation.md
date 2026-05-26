---
type: "auto"
tier: "2a"
description: "Starting a task, switching type, or invoking a command — detect complexity, recommend optimal model (Opus/Sonnet/GPT)"
source: package
triggers:
  - phrase: "switch task"
  - phrase: "new task"
  - phrase: "which model"
routes_to:
  - "command:set-cost-profile"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Model Recommendation

**Iron Law.** On task / model switch, recommend the optimal model for the task complexity before any work begins.

Ordering: ask the handoff / model-switch question **last** — after context and domain clarification questions are resolved. Never front-load the model question before the user has supplied the task context that determines complexity.

Body migrated to `command:set-cost-profile` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
