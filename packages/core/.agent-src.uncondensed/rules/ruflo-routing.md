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

**Iron Law.** When ruflo (ruvnet/ruflo) is installed and the task is
orchestration-shaped (swarm, multi-agent, parallel agents, swarm memory),
load the `ruflo-orchestration` skill and delegate to ruflo's runtime — do NOT
improvise an in-session fan-out and do NOT reach for `subagent-orchestration`
(which is the no-network, ruflo-absent path).

Body migrated to `skill:ruflo-orchestration`. Disambiguates the
ruflo-orchestration ↔ subagent-orchestration cluster (external runtime vs
in-session) and surfaces the governance-scope limit (agent-config governs the
main agent, not ruflo's swarm subagents). Trigger-set above activates this
routing under the `balanced` and `full` profiles when the `ruflo-bridge` pack
is installed.

## See also

- [`skill:ruflo-orchestration`](../skills/ruflo-orchestration/SKILL.md)
- [`ruflo-coexistence`](../../../../docs/contracts/ruflo-coexistence.md)
