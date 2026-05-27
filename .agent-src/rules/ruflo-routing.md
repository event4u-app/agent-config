---
type: "auto"
tier: "3"
description: "Orchestration/swarm/multi-agent work in a ruflo-equipped project — route to the ruflo-orchestration skill, not an in-session fan-out"
source: package
triggers:
  - keyword: "swarm"
  - keyword: "ruflo"
  - keyword: "claude-flow"
  - phrase: "multi-agent"
  - phrase: "in parallel agents"
routes_to:
  - "skill:ruflo-orchestration"
workspaces:
  - engineering
packs:
  - ruflo-bridge
lifecycle: active
trust:
  level: experimental
  confidence: medium
  human_review_required: false
install:
  default: false
  removable: true
---

# Ruflo Routing

**Iron Law.** ruflo installed + orchestration-shaped task (swarm, multi-agent, parallel agents, swarm memory) → load `ruflo-orchestration`, delegate to ruflo's runtime. Do NOT improvise an in-session fan-out; do NOT reach for `subagent-orchestration` (the ruflo-absent path).

Body in `skill:ruflo-orchestration`. Disambiguates ruflo-orchestration ↔ subagent-orchestration (external runtime vs in-session) + surfaces the governance-scope limit (agent-config governs the main agent, not ruflo's swarm subagents). Trigger-set activates under `balanced`/`full` when the `ruflo-bridge` pack is installed.

## See also

- [`skill:ruflo-orchestration`](../skills/ruflo-orchestration/SKILL.md)
- [`ruflo-coexistence`](../../../docs/contracts/ruflo-coexistence.md)
