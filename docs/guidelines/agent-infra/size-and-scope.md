# size-and-scope-guidelines

## Purpose

Ensure all system components stay:

- readable
- maintainable
- executable
- non-redundant

Prevent:
- oversized rules
- bloated skills
- command overreach
- duplicated knowledge

---

# Core principle

> Split by responsibility, NOT by length.

Size is a signal — not the goal.

---

# Golden size rules

## Rules & system instructions

- Ideal: **< 60 lines**
- Acceptable: **< 100–120 lines**
- Hard limit: **< 200 lines**

Linter (council review 2026-05-06): the > 40 / > 60 line warnings are
**density-gated** — rules with ≥ 30 % fenced content (verbatim Iron-Law
blocks, worked-example fences) are exempt from the line-count warning.
The 200-line hard error stays unconditional.

Reason:
- Loaded frequently
- Must be reliably followed
- Large files get partially ignored

---

## Skills

- Target: **300–900 words**
- Warning: **> 400 lines** (raised from 300, council review 2026-05-06)
- Strong split signal: reference-rich skills (analyzer, quality-tool
  catalog, council orchestration) may legitimately sit between 300 and
  400 lines without being split-candidates

Focus:
- scanability
- one responsibility
- executable workflow

---

## Commands

- Target: **200–600 words**
- Acceptable: **up to ~1000 words**
- Warning: **> 1000 words AND lacks delegation structure** (< 5
  sub-sections OR < 3 code blocks). Well-factored orchestrators with ≥ 5
  sub-sections AND ≥ 3 code blocks are exempt — the size reflects
  dispatch breadth, not bloat (council review 2026-05-06).

Commands orchestrate — not implement.

---

## AGENTS.md

- Target: **200–800 words**
- Acceptable: **up to ~1200 words**

High-level only.

---

## copilot-instructions.md

- Ideal: **< 60 lines**
- Acceptable: **< 100–150 lines**

Must stay lightweight.

---

## Guidelines

- Target: **400–1500 words**
- Can exceed if needed

Guidelines are reference — not execution.

---

# Component responsibilities

## Rules

- constraints only
- no workflows
- no long explanations

---

## Skills

Must contain:

- When to use
- Procedure
- Validation
- Output format
- Gotchas
- Do NOT

---

## Commands

- orchestrate workflows
- delegate to skills
- do not contain deep logic

---

## Guidelines

- define conventions
- support skills
- must NOT replace workflows

---

## AGENTS.md

- entrypoint
- system overview
- interaction model

---

## copilot-instructions.md

- behavioral hints
- style guidance

---

# Anti-patterns

## Too large

- skill solves multiple problems
- rule explains instead of constraining
- command contains implementation
- AGENTS.md becomes documentation dump

---

## Too small

- skill has no real workflow
- rule is just a suggestion
- command adds no value

---

# Boundary rule (critical)

> A skill must remain usable WITHOUT opening a guideline.

If not → the skill is too weak.

---

# Decision checklist

Before creating or modifying:

1. Is this a constraint → Rule
2. Is this a workflow → Skill
3. Is this orchestration → Command
4. Is this reference → Guideline
5. Is this entrypoint → AGENTS.md
6. Is this behavior hint → copilot-instructions.md

---

# Final principle

> Small enough to understand quickly
> Large enough to be useful
