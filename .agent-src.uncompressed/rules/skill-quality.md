---
type: "auto"
description: "Creating, editing, or reviewing skills — minimum quality standard, every skill must be executable, validated, and self-contained"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/skill-quality-mechanics.md
---

# Skill Quality

## Minimum Sharpness

Every skill must answer four questions. If ANY answer is weak, the skill is not done.

| # | Question | Section | Standard |
|---|---|---|---|
| 1 | When should I use this? | `When to use` | Concrete trigger, not generic |
| 2 | What exactly do I do? | `Procedure` | Executable steps with decisions |
| 3 | How do I verify it worked? | `Procedure` (validation step) | Concrete checks, not "verify it works" |
| 4 | What common failure must I avoid? | `Gotcha` + `Do NOT` | Real failure patterns, not platitudes |

## Required Sections

Every skill MUST have: `When to use`, `Procedure`, `Gotcha`, `Output format`, `Do NOT`.

## Frontmatter Contract

Every skill's YAML frontmatter MUST validate against `scripts/schemas/skill.schema.json`.
Violations are reported by `scripts/skill_linter.py` as `schema_<rule>` errors
and fail `python3 scripts/validate_frontmatter.py` and the full CI pipeline.

## Description Triggering

Claude routes skills by their frontmatter `description`. Pushy,
trigger-rich descriptions are required — polite or hedged ones cause
undertriggering. The full recipe (concrete verb phrase, ≥2 triggers,
`even if they don't explicitly ask for …` tail, ≤200 chars,
litmus test) lives in
[`contexts/communication/rules-auto/skill-quality-mechanics.md`](../contexts/communication/rules-auto/skill-quality-mechanics.md)
§ Description Triggering.

## Skill Independence

```
If a skill is not executable without opening a guideline, it is broken.
```

- Skills MAY reference guidelines for detailed conventions
- Skills MUST NOT outsource their core workflow to guidelines
- If removing guideline references makes the skill useless → the skill is too weak

**Litmus test:** Cover all guideline references in the Procedure. Is it still executable?
If not → the skill needs more own steps, decisions, and validation — not more guideline links.

## Merge & Compression Preservation

When merging or compressing skills, the result MUST preserve the
strongest validation, strongest examples, all anti-patterns, all
decision criteria, and trigger quality. Full preservation invariants
and "merge is invalid if …" / "compression may remove …" lists in
[`contexts/communication/rules-auto/skill-quality-mechanics.md`](../contexts/communication/rules-auto/skill-quality-mechanics.md)
§ Merge Preservation and § Compression Preservation.

## Refactor Safety

When refactoring or optimizing skills:

- NEVER weaken validation to pass linter
- NEVER remove anti-patterns to reduce size
- NEVER replace concrete checks with "verify it works"
- NEVER merge skills if the result is broader than either source
- ALWAYS run linter before and after — fail count must not increase
