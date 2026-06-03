---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Merging/refactoring/condensing skills, rules, commands, or guidelines — prevent quality loss"
triggers:
  - intent: "merge skill"
  - intent: "condense rule"
  - intent: "refactor artifact"
  - keyword: "Iron Law"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule references the authoring tree as the operand of condensation/preservation."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Preservation Guard

When transforming any agent artifact (merge, refactor, condense, split, restructure),
the result must be **at least as strong** as the original.

## Iron Laws — every passage stays, telegraph is fine

Sections marked **Iron Law** (any heading matching `# Iron Law`, `# Iron Laws`,
`# The Iron Law`, at any heading level, including numbered variants like
`Iron Law 1`, `Iron Law 2`) are **non-negotiable** and require the strictest
preservation:

- [ ] **Heading preserved verbatim** — exact text and exact heading level. Drop the
  heading → the law is gone, even if the code block underneath survives.
- [ ] **Fenced code blocks preserved byte-for-byte** — the law itself.
- [ ] **Negation clauses preserved** — `NO X`, `NEVER Y`, `NOT Z` stay in. These
  are the load-bearing exception denials, not filler.
- [ ] **Every passage stays** — every paragraph, every list item, and every
  fenced code block from the source survives in the condensed output, in
  order. One paragraph → one paragraph; one bullet → one bullet. Dropping
  whole sentences, merging two paragraphs into one, or skipping a list item
  is forbidden, even if the surviving prose still "makes the point".
- [ ] **No Iron Law downgrades** — `## Iron Law` MUST NOT become `### Iron Law`,
  `**Iron Law:**`, or inline prose. Heading level is part of the prominence.

**Telegraph style is encouraged for Iron Law bodies** — drop articles ("the",
"a"), shorten phrasing, primitive grammar, terse cave-speak. Word count is
not a budget; the structural unit count is. As long as every paragraph,
bullet, and code block from the source is present, condense as hard as you
want. What's forbidden is **deletion**: the rationale paragraph stays, the
canonical-failure example stays, every "NEVER X" bullet stays.

`scripts/check_condensation.py` enforces these mechanically — any violation is
an `error`, not a warning.

## Mandatory preservation checklist

Before completing any transformation, verify:

- [ ] **Iron Law sections** preserved per the rules above — heading, body, fenced blocks, rationale
- [ ] **Strongest validation step** preserved — concrete verify/confirm actions survive
- [ ] **Strongest example** preserved — the most illustrative code block or scenario stays
- [ ] **Strongest anti-pattern** preserved — the most important "Do NOT" or failure mode stays
- [ ] **Essential decision hints** preserved — if/when/unless logic that prevents mistakes
- [ ] **Required sections** preserved — When to use, Procedure, Output, Gotchas, Do NOT
- [ ] **Single clear responsibility** preserved — no scope creep from merging unrelated concerns
- [ ] **Strong language** preserved — "MUST", "NEVER", "Do NOT" not weakened to "should", "avoid"

## Reject criteria

**REJECT** the transformation if it:

- Removes or downgrades an Iron Law heading
- Drops a paragraph, list item, or fenced code block from an Iron Law section
- Strips negation clauses or canonical-failure prose from an Iron Law
- Removes a concrete validation step without equivalent replacement
- Removes the strongest example without equivalent replacement
- Removes the strongest anti-pattern without equivalent replacement
- Weakens routing or decision logic
- Broadens scope by merging unrelated workflows
- Weakens strong enforcement language

## Applies to

- Skill merges (combining two skills into one)
- Skill splits (extracting part of a skill)
- Refactoring (restructuring without behavior change)
- Condensation (`.agent-src.uncondensed/` → `.agent-src/`)
- Rule consolidation
- Guideline restructuring

## References

- Skill: `skill-management` — condensation/refactoring modes
- Skill: `skill-reviewer` — condensation safety checks
- Command: `/condense` — condensation quality checklist
- Linter: `scripts/skill_linter.py` — `check_condensation_quality()`
