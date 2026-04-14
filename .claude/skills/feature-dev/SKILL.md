---
name: feature-dev
description: "/feature-dev"
disable-model-invocation: true
---

# /feature-dev

> Full 7-phase feature development workflow for complex features.

## Trigger

`/feature-dev {description}` or `/feature-dev` (interactive)

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

`codebase-retrieval` → similar features, patterns, key files. Module docs + contexts. Present findings.

### Phase 3: Clarifying Questions

Review findings vs request. Identify: edge cases, integration points, backward compat, perf, auth. **STOP — wait for answers.**

### Phase 4: Architecture Design

2-3 approaches: minimal, clean, pragmatic. Per approach: files, new classes, pros/cons. Recommend one. **STOP — ask preference.**

### Phase 5: Implementation

Wait for approval. Task list. Follow chosen architecture + conventions. Tests alongside.

### Phase 6: Quality Review

Review: simplicity, correctness, conventions. Run PHPStan + tests + style. **Ask what to fix now vs defer.**

### Phase 7: Summary

What was built, decisions, files changed. Next steps: tests, docs, follow-ups. Update feature plan if exists.

## Rules

- Never skip phases. Wait at Phase 3 + 4 gates.
- English for docs, German with user. Use task management.
