---
type: "auto"
description: "After completing a task where a repeated mistake or successful pattern appeared — capture as rule or skill"
alwaysApply: false
source: package
---

# Capture Learnings

When a repeated mistake, successful pattern, or new constraint appears,
evaluate whether to capture as **rule** or **skill**.

## Promotion Gate

A learning may be promoted to rule/skill ONLY if ALL gates pass:

| Gate | Question | Must be YES |
|---|---|---|
| Repetition | Occurred at least twice OR clearly generalizable? | ✅ |
| Impact | Improves correctness, reliability, or consistency? | ✅ |
| Failure pattern | Prevents a real, observed failure? | ✅ |
| Non-duplication | No existing rule/skill/guideline covers this? | ✅ |
| Scope fit | Fits rule (constraint), skill (workflow), or guideline (convention)? | ✅ |
| Minimal | Update existing preferred over creation? | Checked |

**Reject immediately if:**
- Occurred only once and is not clearly generalizable
- Similar guidance already exists (update instead)
- Baseline model knowledge or standard tool usage
- Vague frustration without concrete failure pattern

## Triggers

- Mistake that happened 2+ times
- Pattern that improved outcome and should be reused
- Missing constraint that caused issues
- **User frustration or complaint** — extract the underlying failure pattern, don't ignore or defend

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
