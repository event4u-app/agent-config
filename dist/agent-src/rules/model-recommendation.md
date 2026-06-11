---
type: "auto"
tier: "2a"
description: "Starting a task, switching type, or invoking a skill/command that declares a model_tier — switch (Claude) or suggest (any agent) the right capability tier"
triggers:
  - phrase: "switch task"
  - phrase: "new task"
  - phrase: "which model"
  - keyword: "model_tier"
load_context:
  - ../contexts/model-recommendations.md
routes_to:
  - "guideline:agent-infra/model-recommendation"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Model Recommendation

**Iron Law.** When a skill or command carries a `model_tier` (a vendor-neutral capability band), route the turn to **that agent's best model in that band** — automatically where the surface supports a per-turn override, as a single suggestion where it does not. Never recommend another vendor's model. Never double-ask, never front-load the question.

Body migrated to `guideline:agent-infra/model-recommendation` (per the P4 pattern of `road-to-kernel-and-router.md`); task→tier heuristics stay in `contexts/model-recommendations.md` (loaded via `load_context`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
