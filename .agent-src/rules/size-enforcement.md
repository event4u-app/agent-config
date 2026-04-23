---
type: "auto"
description: "Creating or editing rules, skills, commands, guidelines, AGENTS.md, or copilot-instructions.md — enforce size and scope limits"
alwaysApply: false
source: package
---

# size-enforcement

- Split by responsibility, not by length.

- Rules must stay short, constraint-only, and easy to scan.
- Skills must remain executable with clear workflow and validation.
- Commands must orchestrate, not implement detailed workflows.
- Guidelines must not replace skill execution.
- AGENTS.md must stay high-level and not contain workflows.
- copilot-instructions.md must stay short and behavioral.

- If a component grows too large, mixes responsibilities, or becomes hard to scan → split or refactor.

- Prefer small files:
  - Rules and system instructions should stay well below 200 lines
  - Smaller (≈60 lines) is strongly preferred

→ Size limits and details: `.augment/guidelines/agent-infra/size-and-scope.md`

→ Frontmatter contract (required/optional keys per type):
[`agents/docs/frontmatter-contract.md`](../../../agents/docs/frontmatter-contract.md).
Schemas live in `scripts/schemas/` and are enforced by `task validate-schema`.
