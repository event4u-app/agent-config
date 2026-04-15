---
name: post-task-learning-capture
description: "Use after completing a task to capture learnings and decide if they should become a rule or skill."
source: project
---

# post-task-learning-capture

## When to use

* Task just completed
* Problem solved or debugged
* Unexpected issues or friction occurred
* Solution worked particularly well

Do not use when nothing new learned, task was trivial, or no extractable pattern.

## Goal

* Capture useful learnings immediately
* Identify repeated patterns/mistakes/optimizations
* Decide: rule, skill, update, or no action
* Continuously improve system quality

## Preconditions

* Task completed, outcome known
* Process and result can be reflected on

## Decision hints

* Happened more than once → capture
* Changes behavior globally → rule
* Defines repeatable process → skill
* Similar logic exists → update, not new file
* Vague → refine before capturing

## Procedure

### 1. Identify what happened

Goal? Outcome? What went wrong or well?

### 2. Extract concrete learnings (1-3)

Good: "Nested backticks break copyability" / "JSON more reliable than table parsing"
Bad: "That was annoying" / "This was tricky"

### 3. Classify

Constraint / Workflow / Anti-pattern / Optimization / Environment-specific

### 4. Check repetition and impact

Happened before? Likely again? Affects many tasks?

### 5. Decide action

New rule / Update rule / New skill / Update skill / No action

### 6. Draft minimal guidance

Rule: short constraint. Skill: trigger + procedure outline.

### 7. Validate

Actionable? Specific? Non-duplicative? Improves future tasks?

### 8. Keep minimal

Update existing over new files. Focused scope.

## Output format

1. Task summary (1-2 lines)
2. Key learnings (bullets)
3. Classification per learning
4. Decision (rule / skill / update / none)
5. Proposed content (short draft)

## Core rules

* Capture immediately after tasks
* Only actionable, repeatable insights
* Clarity over completeness
* Minimal and focused
* Incremental improvement

## Gotchas

* Model captures vague/useless learnings
* Model over-creates instead of updating
* One-off issues don't justify new guidance
* Too many weak learnings = noise

## Do NOT

* Do NOT capture vague statements without action
* Do NOT create for one-off issues
* Do NOT duplicate existing guidance
* Do NOT overcomplicate simple learnings

## Auto-trigger keywords

* after task, learning, retrospective, what did we learn
* improve next time, capture learning, post-mortem

## Anti-patterns

* Capturing "that was hard" without concrete cause
* Creating skill for every resolved bug
* "Be more careful next time" as learning
* Ignoring learnings because task is done

## Examples

Fix broken markdown → "Nested backticks break copyability" → Update markdown rules
Debug route detection → "JSON more reliable than table parsing" → Create route-inspection skill

## Environment notes

Use immediately after tasks while context is fresh.
