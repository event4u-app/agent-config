---
type: "auto"
tier: "3"
description: "Configuring GitHub Copilot (copilot-instructions.md, PR-review patterns) — route to copilot-config"
triggers:
  - keyword: "copilot"
  - phrase: "copilot-instructions"
  - phrase: "copilot pr review"
routes_to:
  - "skill:copilot-config"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
# obligation: line 19
obligation_frequency: "none"
---

# Copilot Routing

**Iron Law.** Tuning the GitHub Copilot AI assistant itself (instructions, PR-review patterns, suggestion behavior) → load the `copilot-config` skill, not `devcontainer` (which covers the dev environment Copilot runs inside).

Body migrated to `skill:copilot-config`. Disambiguates the copilot-config ↔ devcontainer cluster head per [`adr-architectural-consensus-mechanism`](../../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
