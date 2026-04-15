---
name: roadmap-manager
description: "Use when the user says "create roadmap", "show roadmap", or "execute roadmap". Creates, reads, and manages roadmap files with phase tracking."
source: package
---

# roadmap-manager

## When to use

Use this skill when:
- Creating a new roadmap (`roadmap-create` command)
- Executing a roadmap (`roadmap-execute` command)
- Checking roadmap progress
- Updating roadmap status after completing work


Do NOT use when:
- Small tasks that don't span multiple steps
- One-off questions or fixes

## Procedure: Manage a roadmap

1. **Identify need** — Is this a multi-step change that spans sessions or agents?
2. **Create or locate** — Create new roadmap in `agents/roadmaps/` or find existing one.
3. **Update progress** — Mark completed steps with `[x]`, add notes for blockers.
4. **Verify** — Confirm all steps reflect current state, no stale information.

A roadmap is a structured `.md` file in `agents/roadmaps/` that describes a multi-step change
(refactoring, feature, migration). It ensures work can be picked up across sessions and by
different agents.

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

### Resuming a roadmap

When picking up a roadmap in a new session:
1. Read the roadmap to understand the full context.
2. Check which steps are already completed (`[x]`).
3. Summarize progress to the user.
4. Continue from the next open step.


## Auto-trigger keywords

- roadmap
- roadmap creation
- phase tracking
- step completion

## Output format

1. Roadmap file in agents/roadmaps/ with ordered phases and tasks
2. Progress tracking with checkbox status

## Gotcha

- Roadmap files go in `agents/roadmaps/` — don't create them in other directories.
- Don't mark phases complete without running verification (tests, quality checks) — the verify-before-complete rule applies.
- The model tends to skip phases it deems "simple" — every phase must be explicitly completed.

## Do NOT

- Do NOT skip quality gates between steps.
- Do NOT mark steps as done without actually completing them.
- Do NOT modify completed steps (only add notes if needed).
- Do NOT create roadmaps for trivial changes (single-file fixes don't need a roadmap).
- Do NOT commit or push — only local changes.
