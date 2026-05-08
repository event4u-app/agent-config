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

Linter (structural model, 2026-05-08 — see
[`docs/contracts/linter-structural-model.md`](../../contracts/linter-structural-model.md)):
the long-rule warning fires only when the rule is **> 60 non-empty
lines AND density < 0.50 AND ships no Iron-Law block**. Rules whose
body is a verbatim ALL-CAPS imperative (`commit-policy`,
`ask-when-uncertain`, `direct-answers`) are auto-exempt — no
frontmatter flag required. The 200-line hard error stays
unconditional.

Reason:
- Loaded frequently
- Must be reliably followed
- Large files get partially ignored

---

## Skills

- Target: **300–900 words**
- Warning: **> 400 lines AND (density < 0.60 OR ≥ 2 `## Procedure`
  blocks)** — structural model, 2026-05-08
- Reference-rich skills with high density (`quality-tools` at 0.83,
  catalogue-style skills) pass without splitting; the multi-procedure
  trigger flags genuine cluster-split candidates regardless of size

Focus:
- scanability
- one responsibility
- executable workflow

---

## Commands

- Target: **200–600 words**
- Acceptable: **up to ~1000 words**
- Warning: **> 1000 words AND no delegation signal AND density < 0.65**
  — structural model, 2026-05-08. A delegation signal is either
  frontmatter (`cluster:` / `routes_to:`) OR ≥ 3 markdown links to
  other `.md` files. Well-factored orchestrators pass automatically;
  inlined logic in a non-orchestrator command warns.

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
