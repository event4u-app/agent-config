---
type: "manual"
tier: "mechanical-already"
description: "Creating or editing rules, skills, commands, guidelines, AGENTS.md, or copilot-instructions.md — enforce size and scope limits"
alwaysApply: false
workspaces: [agent-config-maintainer]
packs: [meta]
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

## Per-tool pitfall content

Known-pitfall / troubleshooting content for a tool is a **`## Known pitfalls`
section on that tool's existing skill** (format: `skill-writing` § Known-pitfalls
section) — **never** a new skill per pitfall, and **never** a generated per-tool
grid. A per-vendor pitfall generator (N slots × M tools) is exactly the
skill-sprawl this rule exists to prevent; the topic taxonomy is a *checklist for
authoring one good section*, not a template for many thin skills. Cap: **≤ 5
real, sourced entries** per skill.

- Prefer small files:
  - Rules and system instructions should stay well below 200 lines
  - Smaller (≈60 lines) is strongly preferred

→ Size limits and details: `../../docs/guidelines/agent-infra/size-and-scope.md`

→ Frontmatter contract: schemas live in `scripts/schemas/` and are enforced by
`./scripts-run src/scripts/validate_frontmatter`.
