# size-and-scope-guidelines

## Purpose

Keep all system components readable, maintainable, executable, non-redundant.
Prevent oversized rules, bloated skills, command overreach, duplicated knowledge.

## Core principle

> Split by responsibility, NOT by length.

Size is a signal — not the goal.

## Golden size rules

### Rules & system instructions

- Ideal: **< 60 lines**
- Acceptable: **< 100–120 lines**
- Hard limit: **< 200 lines**

Loaded frequently. Must be reliably followed. Large files get partially ignored.

### Skills

- Target: **300–900 words**
- Warning: **>1200 words**
- Strong split signal: **>1500 words**

Focus: scanability, one responsibility, executable workflow.

### Commands

- Target: **200–600 words**
- Acceptable: **up to ~1000 words**

Commands orchestrate — not implement.

### AGENTS.md

- Target: **200–800 words**
- Acceptable: **up to ~1200 words**

High-level only.

### copilot-instructions.md

- Ideal: **< 60 lines**
- Acceptable: **< 100–150 lines**

Must stay lightweight.

### Guidelines

- Target: **400–1500 words**
- Can exceed if needed

Reference — not execution.

## Component responsibilities

| Component | Purpose |
|---|---|
| Rules | Constraints only. No workflows, no long explanations. |
| Skills | Must contain: When to use, Procedure, Validation, Output format, Gotchas, Do NOT. |
| Commands | Orchestrate workflows. Delegate to skills. No deep logic. |
| Guidelines | Define conventions. Support skills. Must NOT replace workflows. |
| AGENTS.md | Entrypoint. System overview. Interaction model. |
| copilot-instructions.md | Behavioral hints. Style guidance. |

## Anti-patterns

**Too large:** skill solves multiple problems, rule explains instead of constraining, command contains implementation, AGENTS.md becomes documentation dump.

**Too small:** skill has no real workflow, rule is just a suggestion, command adds no value.

## Boundary rule (critical)

> A skill must remain usable WITHOUT opening a guideline.

If not → skill is too weak.

## Decision checklist

1. Constraint → Rule
2. Workflow → Skill
3. Orchestration → Command
4. Reference → Guideline
5. Entrypoint → AGENTS.md
6. Behavior hint → copilot-instructions.md

## Final principle

> Small enough to understand quickly
> Large enough to be useful
