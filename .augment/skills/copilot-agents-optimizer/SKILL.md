---
name: copilot-agents-optimizer
description: "Use when optimizing AGENTS.md or copilot-instructions.md — deduplicates against .augment/ content, enforces line budgets, and focuses each file on its audience."
---

# Copilot & AGENTS Optimizer Skill

## When to use

`/docs-optimize`, checking content placement, deduplication after `.augment/` changes, line budget enforcement. NOT for: coding, new skills/commands.

## AGENTS.md (Augment Agent, reads `.augment/`, ≤500 lines ideal, max 1000)

**Belongs:** stack, Docker, Make targets, DB setup, testing, quality commands, structure overview.
**NOT:** coding standards (→ rules/guidelines), architecture principles (→ rules), PHP conventions (→ guidelines), module details (→ module docs).

## copilot-instructions.md (Copilot, self-contained for Code Review, ≤500 ideal, max 1000)

**Belongs:** architecture rules, PHP patterns, project conventions, review rules, language, known false positives.
**NOT:** Docker/Make (Copilot doesn't run), testing setup, agent infra, ECS/Rector-enforced rules.

## Deduplication

Canonical: rules → `.augment/rules/`, conventions → guidelines, expertise → skills, project → agents/.

copilot-instructions MAY duplicate (concise, Copilot-relevant, stable rules). AGENTS.md NEVER duplicates `.augment/` — reference instead.

## Over budget? Extract to `agents/`, remove duplicates, compress, remove ECS/Rector rules, move examples to guidelines.

## Checklist: budget OK? No duplication with `.augment/`? AGENTS.md references not copies? Copilot self-contained? No auto-fixed rules? Sections relevant?

## Related: `/copilot-agents-optimize`, `copilot`, `agent-docs`, `augment-infrastructure.md`

## Gotcha: AGENTS.md affects all AI tools, verify before removing, model over-optimizes.

## Do NOT: `.augment/` content in AGENTS.md, exceed budgets, duplicate rules.
