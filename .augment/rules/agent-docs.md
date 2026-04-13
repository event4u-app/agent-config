---
type: "auto"
description: "Reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md"
---

# Agent Documentation

## When to read

**Before ANY work**, read relevant docs:

1. `AGENTS.md` (project root) — project-level setup/conventions
2. `./agents/` — project-specific architecture, guidelines, domain docs
3. `agents/contexts/domain/` — domain contexts relevant to current work
4. `app/Modules/{Module}/agents/` — module-specific docs (incl. `agents/contexts/`)
5. Package `./agents/` directory
6. Existing roadmap for current work → follow its steps

## When to update

After changes, check if docs need updating:

- New module → create `app/Modules/{Module}/agents/`
- Schema changed → update `agents/docs/database-setup.md`
- New service/pattern → update relevant guidelines
- Roadmap step done → mark `[x]`
- Structural changes → update affected docs

If unsure → **ask the user**.

## Roadmaps

For significant multi-step/multi-session changes:
- Ask user about creating roadmap in `agents/roadmaps/`
- Use `roadmap-create` command
- Ensures continuity across sessions/agents

## Documentation language

- All `.md` files in **English**
- German/other language files → translate when touched

## Do NOT

- Create docs without real need
- Duplicate info from `AGENTS.md` or `.github/copilot-instructions.md`
- Write docs to document what you did — only what others need to know
