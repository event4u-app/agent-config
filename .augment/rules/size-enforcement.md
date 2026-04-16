---
type: "auto"
description: "Creating or editing rules, skills, commands, guidelines, AGENTS.md, or copilot-instructions.md — enforce size and scope limits"
alwaysApply: false
source: package
---

# size-enforcement

- Split by responsibility, not by length.

- Rules: short, constraint-only, easy to scan.
- Skills: executable with clear workflow + validation.
- Commands: orchestrate, not implement.
- Guidelines: must not replace skill execution.
- AGENTS.md: high-level, no workflows.
- copilot-instructions.md: short, behavioral.

- Component grows too large, mixes responsibilities, or hard to scan → split or refactor.

- Prefer small files:
  - Rules and system instructions: well below 200 lines
  - Smaller (≈60 lines) strongly preferred

→ Full limits: `.augment/guidelines/agent-infra/size-and-scope.md`
