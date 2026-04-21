---
type: "auto"
description: "Creating, editing, or reviewing skills — minimum quality standard, every skill must be executable, validated, and self-contained"
alwaysApply: false
source: package
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

## Description Triggering

Claude routes skills by the frontmatter `description`. Polite, generic, or
hedged descriptions cause **undertriggering** — the skill never loads.

Pushy descriptions:

- Start with a concrete verb phrase: `Use when ...`, `Creates ...`, `Reviews ...`.
- Name 2+ concrete triggers (domains, symptoms, file types, user phrasing).
- End with: `... even if they don't explicitly ask for \`<skill-name>\`.`
- No hedges: `may help with`, `can be useful for`, `covers various`.
- **≤ 200 chars** (linter: `description_too_long`). Cut adjectives or
  collapse lists before dropping triggers or the `even if ...` tail.

Source: [`skills/skill-creator`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
via [`road-to-anthropic-alignment.md`](../../../agents/roadmaps/road-to-anthropic-alignment.md) Phase 2.

**Litmus test:** Read the description cold. If you cannot name two phrasings a
user would type that should route to this skill, rewrite it.

## Skill Independence

```
If a skill is not executable without opening a guideline, it is broken.
```

- Skills MAY reference guidelines for detailed conventions
- Skills MUST NOT outsource their core workflow to guidelines
- If removing guideline references makes the skill useless → the skill is too weak

**Litmus test:** Cover all guideline references in the Procedure. Is it still executable?
If not → the skill needs more own steps, decisions, and validation — not more guideline links.

## Merge Preservation

When merging or refactoring skills, the merged result MUST preserve:

1. **Strongest validation** from each source skill
2. **Strongest example** (good/bad contrast) from each source
3. **Strongest anti-pattern** from each source
4. **All concrete decision criteria** that differ between sources

A merge is invalid if:
- Validation got weaker than the strongest source
- Examples were lost without replacement
- Anti-pattern coverage decreased
- The merged skill became a generic umbrella doc

## Compression Preservation

When compressing a skill, the compressed version MUST preserve:

- Trigger quality (description + When to use)
- All procedure steps that contain decisions
- All concrete validation checks
- All gotchas and anti-patterns
- Strongest example (at minimum one good/bad contrast)

Compression may remove:
- Verbose explanations
- Redundant examples (keep the strongest)
- Commentary that doesn't affect execution

## Refactor Safety

When refactoring or optimizing skills:

- NEVER weaken validation to pass linter
- NEVER remove anti-patterns to reduce size
- NEVER replace concrete checks with "verify it works"
- NEVER merge skills if the result is broader than either source
- ALWAYS run linter before and after — fail count must not increase
