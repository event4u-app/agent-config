---
type: "always"
description: "Capture repeated learnings as rules or skills — don't let the same mistake happen twice"
alwaysApply: true
source: package
---

# Capture Learnings

When a repeated mistake, successful pattern, or new constraint appears,
evaluate whether to capture as **rule** or **skill**.

## Promotion Gate

A learning may be promoted ONLY if ALL gates pass:

| Gate | Question | Must be YES |
|---|---|---|
| Repetition | Occurred 2+ times OR clearly generalizable? | ✅ |
| Impact | Improves correctness, reliability, or consistency? | ✅ |
| Failure pattern | Prevents a real, observed failure? | ✅ |
| Non-duplication | No existing rule/skill/guideline covers this? | ✅ |
| Scope fit | Fits rule (constraint), skill (workflow), or guideline (convention)? | ✅ |
| Minimal | Update existing preferred over creation? | Checked |

**Reject immediately if:**
- Occurred only once, not generalizable
- Similar guidance already exists (update instead)
- Baseline model knowledge or standard tool usage
- Vague frustration without concrete failure pattern

## Capture

- Mistake that happened 2+ times
- Pattern that improved outcome and should be reused
- Missing constraint that caused issues

## Do NOT capture

- One-off problems
- Vague frustrations without concrete consequence
- Content already covered by existing guidance

## Rule vs Skill

- **Rule** → always-apply constraint ("never X", "always Y")
- **Skill** → repeatable workflow with steps ("when X, do 1-5")
- **Update** → existing guidance covers topic → extend, don't duplicate

## How

- Smallest effective change
- Update existing over creating duplicates
- Full workflow: `learning-to-rule-or-skill` skill
