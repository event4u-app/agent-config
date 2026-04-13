---
skills: [agent-docs]
description: Interactively create a new roadmap file in agents/roadmaps/
---

# roadmap-create

## Instructions

### 1. Location: `1. Project root` / `2. Module`

### 2. Read `.augment/templates/roadmaps.md`

### 3. Gather interactively

Step by step: title/goal, context, phases, steps per phase. Confirm after each. File in **English** (translate user input).

### 4. Build the roadmap file

Use the template structure:

```markdown
# Roadmap: {title}

> {One sentence goal}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant module docs
- [ ] {any specific prerequisites}

## Context

{Context from user input}

## Phase 1: {name}

- [ ] **Step 1:** {description}
- [ ] **Step 2:** {description}
- [ ] ...

## Phase 2: {name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {criteria}
- [ ] All quality gates pass (PHPStan, Rector, tests)

## Notes

{Optional notes}
```

### 5. Review loop — show, ask adjust, repeat

### 6. Save — kebab-case filename, show path

### 7. Offer `/roadmap-execute`

### Rules

- No auto-generated content. No commit/push. English. Template-based. Max 500-1000 lines.

