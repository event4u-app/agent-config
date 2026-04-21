---
type: "auto"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
---

# Package Portability

Everything shipped with `event4u/agent-config` MUST be **project-agnostic**:

- `.augment/` (skills, rules, commands, guidelines, templates, contexts)
- Package root `AGENTS.md`
- Package `.github/copilot-instructions.md`

All three are either installed into consumer projects (`.augment/` via
`install.sh`) or read by AI tools working on the package itself. Leaking
consumer-specific content pollutes downstream or misleads agents.

## Rules

- NEVER reference a specific consumer project, repo, domain, or tech
  stack. The package repo itself (`event4u/agent-config`) MAY appear
  in its own root `AGENTS.md` / `copilot-instructions.md` — meta about
  the package, not a leak.
- NEVER hardcode consumer-project paths, class names, or conventions.
- Write content so it works as a reusable package across any project.
- Project-specific behavior belongs in the **consumer's**
  `.agent-settings.yml`, `AGENTS.md`, or `agents/` — never here.
- If a skill/rule needs project-specific input: read from
  `.agent-settings.yml` or accept as parameter.
- Always ask when editing package files: "Would this still make sense
  in a completely different project?"

## Enforcement

`scripts/check_portability.py` scans `.augment/`, `.agent-src.uncompressed/`,
and the package root `AGENTS.md` + `.github/copilot-instructions.md` for
forbidden identifiers. Part of `task ci` — must pass before any PR.
