---
type: "auto"
alwaysApply: false
description: "When merging, refactoring, compressing, or restructuring skills, rules, commands, or guidelines — prevent quality loss"
source: package
---

# Preservation Guard

When transforming any agent artifact (merge, refactor, compress, split, restructure),
the result must be **at least as strong** as the original.

## Mandatory preservation checklist

Before completing any transformation, verify:

- [ ] **Strongest validation step** preserved — concrete verify/confirm actions survive
- [ ] **Strongest example** preserved — the most illustrative code block or scenario stays
- [ ] **Strongest anti-pattern** preserved — the most important "Do NOT" or failure mode stays
- [ ] **Essential decision hints** preserved — if/when/unless logic that prevents mistakes
- [ ] **Required sections** preserved — When to use, Procedure, Output, Gotchas, Do NOT
- [ ] **Single clear responsibility** preserved — no scope creep from merging unrelated concerns
- [ ] **Strong language** preserved — "MUST", "NEVER", "Do NOT" not weakened to "should", "avoid"

## Reject criteria

**REJECT** the transformation if it:

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
- Compression (`.agent-src.uncompressed/` → `.augment/`)
- Rule consolidation
- Guideline restructuring

## References

- Skill: `skill-management` — compression/refactoring modes
- Skill: `skill-reviewer` — compression safety checks
- Command: `/compress` — compression quality checklist
- Linter: `scripts/skill_linter.py` — `check_compression_quality()`
