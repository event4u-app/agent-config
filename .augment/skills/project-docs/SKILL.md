---
name: project-docs
description: "Use when looking for project-specific documentation. Knows which docs exist in agents/docs/ and agents/contexts/ and maps work areas to relevant docs."
---

# project-docs

## When to use

Finding relevant docs for work areas, unfamiliar codebase areas, project-specific patterns. NOT for: guidelines (`guidelines`), infra (`aws-infrastructure`, `docker`).

Maps work areas → docs. Activate before any area with project docs. Identify area → read context → detail docs → follow conventions.

## Documentation Structure

```
agents/
├── contexts/          → Quick orientation (read first)
│   ├── *.md           → Technical contexts (multi-tenancy, API versioning, etc.)
│   └── domain/        → Domain/industry knowledge (business logic, terminology)
│       └── job-*.md   → Domain context files (e.g., job-time-tracking.md)
├── docs/              → Deep dives (read when working on the area)
│   └── *.md           → Detailed conventions per topic
├── features/          → Feature plans
├── roadmaps/          → Step-by-step work plans
├── sessions/          → Session tracking
└── overrides/         → Project-specific overrides of .augment/ resources
```

## Domain contexts (`agents/contexts/domain/`): business knowledge, `job-*` prefix. Read before business logic work.

## Finding docs: list `agents/contexts/` → `agents/contexts/domain/` → `agents/docs/` → module `agents/`. Match by filename. Always list, don't hardcode.

## Reading order: contexts (orientation ~100 lines) → domain knowledge → module contexts → detail docs (code examples).

## Rules: context first, detail when coding, don't skip ("I know"), update docs when changing conventions.

## Related: `agent-docs`, `context`, `module`


## Gotcha

- Project docs are NOT the same as agent docs — project docs describe the codebase, agent docs describe agent behavior.
- Don't assume a doc exists because the area is important — always check the filesystem first.
- Stale docs are worse than missing docs — always verify doc content against actual code.

## Do NOT

- Do NOT create documentation that duplicates existing docs.
- Do NOT write docs for trivial or self-explanatory code.

## Auto-trigger keywords

- project documentation
- doc mapping
- work area docs
