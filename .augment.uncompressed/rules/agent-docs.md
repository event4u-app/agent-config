---
type: "auto"
description: "Reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md"
source: package
---

# Agent Documentation

## When to read agent docs

**Before starting ANY work**, read the relevant documentation:

1. **Always read** `AGENTS.md` (if it exists in the project root) for project-level setup and conventions.
2. **Always read** `./agents/` for project-specific architecture, guidelines, and domain docs.
3. **If domain contexts exist** (`agents/contexts/domain/`) → read any that are relevant to the current work area.
4. **If working on a module** → also read `app/Modules/{Module}/agents/` for module-specific docs,
   including `agents/contexts/` within the module if it exists.
5. **If working on a package** → read the package's `./agents/` directory.
6. **If a roadmap exists** for the current work → read it first and follow its steps.

## When to update agent docs

After making changes, check if any agent docs need to be updated:

- **New module created** → create `app/Modules/{Module}/agents/` with at least a module description.
- **Database schema changed** → update `agents/docs/database-setup.md` or equivalent.
- **New service/pattern introduced** → update relevant guideline docs.
- **Roadmap step completed** → mark it as done in the roadmap file (`[x]`).
- **Structural changes** (new conventions, renamed classes, moved files) → update affected docs.

If unsure whether a doc needs updating, **ask the user**.

## When to create roadmaps

When working on a **significant change** that spans multiple steps or sessions:

- Ask the user whether to create a roadmap in `agents/roadmaps/`.
- Use the `roadmap-create` command if yes.
- This ensures future sessions (and other agents) can pick up the work.

## Documentation language

- All `.md` files must be written in **English**.
- If an existing file is in German or another language, translate it to English when you touch it.

## Do NOT

- Do NOT create docs unless there's a real need (new module, significant change, etc.).
- Do NOT duplicate information that's already in `AGENTS.md` or `.github/copilot-instructions.md`.
- Do NOT write docs just to document what you did — only document things others need to know.
