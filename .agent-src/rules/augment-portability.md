---
type: "auto"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
---

# .augment/ Portability

Everything inside `.augment/` (skills, rules, commands, templates, contexts) MUST be **project-agnostic**.

- NEVER reference a specific project, repo name, domain, or tech stack directly.
- NEVER hardcode project-specific paths, class names, or conventions.
- Write content so it works as a **reusable package** across any project.
- Project-specific behavior belongs in `.agent-settings.yml`, `AGENTS.md`, or `agents/` — not in `.augment/`.
- If a skill or rule needs project-specific input, read it from `.agent-settings.yml` or accept it as a parameter.
- When reviewing or editing `.augment/` files, always ask: "Would this still make sense in a completely different project?"
