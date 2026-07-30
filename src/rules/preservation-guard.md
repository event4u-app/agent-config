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
workspaces: [agent-config-maintainer]
packs: [meta]
enforced_by:
  - "validator:src/scripts/check_condensation.ts"
  - "validator:src/scripts/skill_linter.ts"
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

`scripts/check_condensation.ts` enforces these mechanically — any violation is
an `error`, not a warning. Since ADR-201 it enforces them the strongest way
available: byte-exactness between source and projection. Structural findings
(lost heading, mangled fence, dropped passage) are retained as diagnostics that
name *what* differs when the bytes do.

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
- ~~Condensation (source tree → `dist/agent-src/`)~~ — **no longer applicable
  (ADR-201, accepted 2026-07-29).** `.md` is copied verbatim and path-rewritten,
  so the projection cannot drop a passage, downgrade an Iron Law heading, or
  mangle a code block: `check_condensation` now asserts `dist == rewrite(src)`
  byte-for-byte. The obligations below still bind every *authoring* transform in
  this list — they simply have nothing left to police in the projection.
- Rule consolidation
- Guideline restructuring

## References

- Skill: `skill-management` — condensation/refactoring modes
- Skill: `skill-reviewer` — condensation safety checks
- Command: `/condense` — condensation quality checklist
- Linter: `scripts/skill_linter.ts` — `check_condensation_quality()`
