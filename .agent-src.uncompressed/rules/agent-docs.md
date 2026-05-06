---
type: "auto"
tier: "2a"
description: "Reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md"
source: package
triggers:
  - path_prefix: "agents/"
  - path_prefix: ".github/copilot-instructions"
  - keyword: "AGENTS.md"
  - keyword: "roadmap"
routes_to:
  - "skill:agent-docs-writing"
---

# Agent Docs

**Iron Law.** Read agent docs (`AGENTS.md`, `agents/`, module `agents/`) before work; update them after structural changes.

Body migrated to `skill:agent-docs-writing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
