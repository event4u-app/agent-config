---
name: roadmap-manager
description: "Use when the user says "create roadmap", "show roadmap", or "execute roadmap". Creates, reads, and manages roadmap files with phase tracking."
---

# roadmap-manager

## When to use

Create/execute/check/update roadmaps. NOT for: small tasks, one-off fixes.

Roadmap = structured `.md` in `agents/roadmaps/` for multi-step work (refactoring, feature, migration). Resumable across sessions.

## Roadmap locations

| Location | Scope |
|---|---|
| `agents/roadmaps/` | Project-wide roadmaps |
| `app/Modules/{Module}/agents/roadmaps/` | Module-specific roadmaps |
| `{package-root}/agents/roadmaps/` | Package-specific roadmaps |

The file `.augment/templates/roadmaps.md` defines the canonical structure.
**Always read it first** before creating or modifying roadmaps.

## Roadmap structure

Every roadmap follows this structure:

```markdown
# Roadmap: {Short descriptive title}

> {One sentence: What is the expected outcome?}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant docs
- [ ] {specific prerequisites}

## Context

{Why this roadmap exists. Which module/domain. Links to Jira tickets.}

## Phase 1: {Phase name}

- [ ] **Step 1:** {Clear, actionable instruction}
- [ ] **Step 2:** {Next step — reference files/classes}
- [ ] ...

## Phase 2: {Phase name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {Observable, testable criterion}
- [ ] All quality gates pass (PHPStan, Rector, tests)

## Notes

{Edge cases, decisions, links}
```

## Key rules for roadmaps

### Checkboxes

- Every actionable step uses `- [ ]` (unchecked) or `- [x]` (completed).
- Mark steps as `[x]` immediately after completing them.
- Never remove completed steps — they serve as history.

### Phases

- Group related steps into phases (e.g. "Preparation", "Migration", "Cleanup").
- Complete one phase before starting the next (unless steps are independent).
- After completing a phase, summarize what was done.

### Quality gates

Every roadmap implicitly includes these gates (run after each step that changes code):

- PHPStan must pass (detect command: artisan vs composer, see `rules/docker-commands.md`)
- Rector: run with fix flag, verify no new PHPStan errors
- Tests: run affected tests

### Step granularity

- Each step should be completable in one session (< 1 hour of work).
- If a step is too large, break it down into sub-steps.
- Steps should reference specific files/classes when possible.

### Language

- Roadmap files are written in **English** (per project convention).
- Step descriptions should be precise and actionable, not vague.

## Working with roadmaps

### Creating a roadmap

1. Ask the user for goal, context, and phases.
2. Use the template structure from `.augment/templates/roadmaps.md`.
3. Review with the user iteratively until approved.
4. Save with a kebab-case filename (e.g. `optimize-webhook-jobs.md`).

### Executing a roadmap

1. Read the full roadmap.
2. Find the next unchecked step (`- [ ]`).
3. Summarize what needs to be done.
4. Ask the user before implementing (numbered options: implement / adjust / skip).
5. After implementation: mark `[x]`, run quality gates.
6. Move to the next step.

### Resuming: read full roadmap → check `[x]` progress → summarize → continue from next open.

## Gotcha: only in `agents/roadmaps/`, verify before marking done, every phase must be completed.

## Do NOT: skip quality gates, mark undone steps done, modify completed steps, roadmaps for trivial changes, commit/push.
