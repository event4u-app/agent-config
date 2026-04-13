---
name: agent-docs
description: "Use when reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md. Understands the full .augment/, agents/, and copilot-instructions structure."
---

# agent-docs

## When to use

Navigating/creating/updating agent docs, module docs, roadmaps, AGENTS.md. NOT for: coding (use coding skills), guidelines (use `guidelines` skill).

## Documentation layers

1. **`.augment/`** — cross-project (rules, commands, skills, contexts, templates, guidelines). Identical across repos. English. Never project-specific.
2. **`AGENTS.md`** — project entry point (stack, setup, testing, quality). First file agent reads.
3. **`.github/copilot-instructions.md`** — coding standards for Copilot. Not always present.
4. **`agents/overrides/`** — project overrides of `.augment/` (rules/skills/commands/guidelines/templates). Mode: `extend` or `replace`. See `override-system.md`.
5. **`agents/`** — project docs (architecture, conventions, features/, roadmaps/, contexts/).
6. **`app/Modules/*/agents/`** — module-scoped docs (description, features, roadmaps, contexts).
7. **`Docs/`** — human-readable technical docs (vs `agents/` for AI).
8. **Package docs** — same structure, `agents/` + optional `AGENTS.md`.

## Reading order: AGENTS.md → copilot-instructions.md → overrides → agents/ → module agents/ → features/ → roadmaps/

## Create docs: new module → module agents/. Multi-step change → roadmap. New convention → agents/ or guidelines/. Schema change → database-setup.md.

## Doc sync (after changes): migration → DB docs, new endpoint → OpenAPI + AGENTS.md, new module → module agents/, new env var → .env.example, Docker change → Docker docs. Unsure → ask user.

## Rules: English `.md`, don't create unnecessarily, don't duplicate, ask before auto-updating.

## Gotcha: scope-control overrides (don't create without request), check existing before creating, AGENTS.md ≠ copilot-instructions.md (different audiences), module docs in module dir.

## Do NOT: create without need, duplicate info, document just what you did.
