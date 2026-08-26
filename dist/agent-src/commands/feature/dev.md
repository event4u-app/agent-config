---
model_tier: inherit
name: feature-dev
pack: engineering-base
visibility: internal
cluster: feature
sub: dev
description: Full 7-phase feature development workflow for complex features.
argument-hint: "[description]"
skills: [laravel, php-coder, test-driven-development]
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /feature:dev

> Full 7-phase feature development workflow for complex features.

## Trigger

`/feature:dev {description}` or `/feature:dev` (interactive)

## When to use

- New features that touch multiple files or modules
- Features requiring architecture decisions
- Complex integrations with existing code
- Features where requirements are unclear

Do NOT use for single-line fixes, trivial changes, or urgent hotfixes.

## Workflow

### Phase 1: Discovery

1. If no description provided, ask: "What feature do you want to build?"
2. Clarify the feature request:
   - What problem does it solve?
   - Who benefits?
   - What are the constraints?
3. Summarize understanding and **confirm with the user** before proceeding.

### Phase 2: Codebase Exploration

1. Use `codebase-retrieval` to find:
   - Similar features already implemented
   - Architecture patterns in the affected area
   - Key files, services, models, routes involved
2. Read identified files to build deep understanding.
3. Check module docs via `enumerate_modules()` — for each module, look in `{module_path}/{modules.agent_folder}/` (Laravel shape: `app/Modules/*/agents/`) if applicable.
4. Check existing contexts (`agents/settings/contexts/`) for the affected area.
5. Present findings with file references.

### Phase 3: Clarifying Questions

1. Review codebase findings against the feature request.
2. Identify underspecified aspects:
   - Edge cases and error handling
   - Integration points with existing code
   - Backward compatibility concerns
   - Performance requirements
   - Authorization and security
3. Present all questions in an organized list.
4. **STOP — Wait for answers before proceeding.**

### Phase 4: Architecture Design

1. Design 2-3 implementation approaches:
   - **Minimal changes** — smallest change, maximum reuse of existing code
   - **Clean architecture** — best maintainability, elegant abstractions
   - **Pragmatic balance** — speed + quality tradeoff
2. For each approach, describe:
   - Files to create/modify
   - New classes, services, or patterns introduced
   - Pros and cons
3. Present comparison and recommend one approach.
4. **STOP — Ask which approach the user prefers.**

### Phase 5: Implementation

1. **Wait for explicit approval** before writing code.
2. Create a task list with all implementation steps.
3. Follow chosen architecture from Phase 4.
4. Follow codebase conventions strictly (read guidelines).
5. Update task list as progress is made.
6. Work **one behavior at a time**: write the failing test for that behavior,
   observe it fail, write the minimum code that makes that one behavior pass,
   then take the next behavior. A test phase followed by a code phase is
   batch-TDD, not test-first — it buys the ordering and loses the feedback.
   The only exceptions are the Do-NOT list in the `test-driven-development`
   skill; a skipped test-first cycle is recorded in the decision log, never silent.

### Phase 6: Quality Review

1. Review the implementation for:
   - **Simplicity & DRY** — is the code as simple as possible?
   - **Correctness** — are there logic errors or missing edge cases?
   - **Conventions** — does it follow project patterns?
2. Run quality tools:
   - Static analysis (PHPStan, tsc, mypy — whichever the project runs)
   - Tests
   - Code style
3. Present findings with severity levels.
4. **Ask what to fix now vs. defer.**

### Phase 7: Summary

1. Summarize:
   - What was built
   - Key decisions made (and why)
   - Files created/modified
2. Suggest next steps:
   - Additional tests needed
   - Documentation updates
   - Follow-up features or improvements
3. If a feature plan exists, update it.

## Rules

- **Never skip phases** — each phase builds on the previous one.
- **Always wait for user input** at Phase 3 and Phase 4 gates.
- **All output in English** for documentation; speak German with the user.
- **Use task management** to track progress through phases.
- **Reference the `feature-planning` skill** for feature plan format.
