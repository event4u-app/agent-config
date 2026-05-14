---
type: "auto"
tier: "3"
description: "When configuring the GitHub Copilot AI assistant — copilot-instructions.md, PR-review comment patterns, suggestion behavior — route to the copilot-config skill"
source: package
triggers:
  - keyword: "copilot"
  - phrase: "copilot-instructions"
  - phrase: "copilot pr review"
routes_to:
  - "skill:copilot-config"
---

# Copilot Routing

**Iron Law.** Tuning the GitHub Copilot AI assistant itself (instructions, PR-review patterns, suggestion behavior) → load the `copilot-config` skill, not `devcontainer` (which covers the dev environment Copilot runs inside).

Body migrated to `skill:copilot-config`. Disambiguates C05 (copilot-config ↔ devcontainer) per [`agents/roadmaps/step-1-v2-feedback-followup.md`](../../agents/roadmaps/step-1-v2-feedback-followup.md) Phase 3.3.
Trigger-set above activates this routing under the `balanced` and `full` profiles.
