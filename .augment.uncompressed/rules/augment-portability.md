---
type: "auto"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
---

# Package Portability

Everything that ships with the `event4u/agent-config` package MUST be
**project-agnostic**. That includes:

- Everything inside `.augment/` (skills, rules, commands, guidelines,
  templates, contexts)
- The package repo's own root `AGENTS.md`
- The package repo's own `.github/copilot-instructions.md`

All three are either installed into consumer projects (`.augment/` via
`install.sh`) or read by AI tools when working on the package itself
(`AGENTS.md`, `copilot-instructions.md`). Leaking consumer-specific
content into any of them pollutes downstream projects or misleads agents.

## Rules

- NEVER reference a specific consumer project, repo name, domain, or tech
  stack directly. The package repo itself (`event4u/agent-config`) MAY be
  named inside its own root `AGENTS.md` and `copilot-instructions.md` —
  that is meta about the package, not a leak.
- NEVER hardcode consumer-project paths, class names, or conventions.
- Write content so it works as a **reusable package** across any project.
- Project-specific behavior belongs in the **consumer's** `.agent-settings`,
  `AGENTS.md`, or `agents/` — never in files shipped by this package.
- If a skill or rule needs project-specific input, read it from
  `.agent-settings` or accept it as a parameter.
- When reviewing or editing package files, always ask: "Would this still
  make sense in a completely different project?"

## Enforcement

`scripts/check_portability.py` scans `.augment/`, `.augment.uncompressed/`,
and the package repo's root `AGENTS.md` + `.github/copilot-instructions.md`
for forbidden identifiers. It is part of `task ci` and must pass before
any PR.
