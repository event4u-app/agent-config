---
type: "auto"
description: "Creating, editing, or reviewing skills — minimum quality standard, every skill must be executable, validated, and self-contained"
alwaysApply: false
source: package
---

# Skill Quality

## Minimum Sharpness

Every skill must answer four questions. If ANY weak → not done.

| # | Question | Section | Standard |
|---|---|---|---|
| 1 | When should I use this? | `When to use` | Concrete trigger, not generic |
| 2 | What exactly do I do? | `Procedure` | Executable steps with decisions |
| 3 | How do I verify it worked? | `Procedure` (validation step) | Concrete checks, not "verify it works" |
| 4 | What common failure must I avoid? | `Gotcha` + `Do NOT` | Real failure patterns, not platitudes |

## Required Sections

Every skill MUST have: `When to use`, `Procedure`, `Gotcha`, `Output format`, `Do NOT`.

## Skill Independence

```
If a skill is not executable without opening a guideline, it is broken.
```

- MAY reference guidelines for conventions
- MUST NOT outsource core workflow to guidelines
- If removing guideline refs makes skill useless → skill too weak

**Litmus test:** Cover guideline references. Is Procedure still executable? If not → fix skill.

## Merge Preservation

Merged result MUST preserve:
1. Strongest validation from each source
2. Strongest example from each source
3. Strongest anti-pattern from each source
4. All concrete decision criteria

Invalid if: validation weaker, examples lost, anti-patterns decreased, result became umbrella doc.

## Compression Preservation

MUST preserve: triggers, decision steps, validation checks, gotchas, strongest example.
May remove: verbose explanations, redundant examples, non-execution commentary.

## Refactor Safety

- NEVER weaken validation to pass linter
- NEVER remove anti-patterns to reduce size
- NEVER replace concrete checks with "verify it works"
- NEVER merge if result broader than either source
- ALWAYS run linter before and after — fail count must not increase
