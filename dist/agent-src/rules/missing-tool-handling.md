---
type: auto
tier: "2a"
description: "CLI tool needed for the task is not installed — ask before working around it; do NOT install silently"
triggers:
  - keyword: "command not found"
  - keyword: "not installed"
  - intent: "install tool"
routes_to:
  - "guideline:agent-infra/missing-tool-handling"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Missing Tool Handling

**Iron Law.** A CLI tool the task genuinely needs is not installed (`command not found`, `which X` empty) → STOP and ask with numbered options; never install silently, never silently substitute a brittle workaround.

Body migrated to `guideline:agent-infra/missing-tool-handling` (per the P4 pattern of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
