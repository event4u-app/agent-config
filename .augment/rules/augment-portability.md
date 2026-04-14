---
type: "auto"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
---

# .augment/ Portability

Everything in `.augment/` MUST be **project-agnostic**.

- NEVER reference specific project, repo name, domain, or tech stack
- NEVER hardcode project-specific paths, class names, or conventions
- Content must work as **reusable package** across any project
- Project-specific behavior → `.agent-settings`, `AGENTS.md`, or `agents/`
- Need project input → read from `.agent-settings` or accept as parameter
- Test: "Would this make sense in a completely different project?"
