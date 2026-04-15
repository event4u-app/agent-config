---
name: post-task-learning-capture
description: "Use after completing a task to capture learnings and decide if they should become a rule or skill."
source: project
---

# post-task-learning-capture

## When to use

Use this skill when:

* A task has just been completed
* A problem was solved or debugged
* Unexpected issues or friction occurred
* A solution worked particularly well
* You want to improve future outputs

Typical examples:

* After fixing a bug
* After debugging a failing command
* After generating broken output (e.g. markdown issues)
* After discovering a better workflow

Do not use this skill when:

* Nothing new was learned
* The task was trivial and fully standard
* No pattern or insight can be extracted

## Goal

* Capture useful learnings immediately after a task
* Identify repeated patterns, mistakes, or optimizations
* Decide whether the learning should become a rule, skill, or update
* Continuously improve system quality over time

## Preconditions

* A task has been completed
* Outcome is known (success or failure)
* The process and result can be reflected on

## Decision hints

* Issue happened more than once → likely worth capturing
* Learning changes behavior globally → rule
* Learning defines repeatable process → skill
* Similar logic already exists → update instead of new file
* Learning is vague → refine before capturing

## Procedure

### 1. Identify what happened

* What was the goal?
* What was the outcome?
* What went wrong or especially well?

### 2. Extract concrete learning

Write 1–3 clear learnings.

Good:
* Nested backticks break markdown copyability
* JSON output is more reliable than parsing CLI tables

Bad:
* That was annoying
* This was tricky

### 3. Classify the learning

Mark each as:
* Constraint (always apply)
* Workflow (step-by-step process)
* Anti-pattern
* Optimization
* Environment-specific

### 4. Check repetition and impact

* Has this happened before?
* Will it likely happen again?
* Does it affect many tasks or just this one?

### 5. Decide action

* Create new rule
* Update existing rule
* Create new skill
* Update existing skill
* No action

### 6. Draft minimal guidance

Rule: short, strict constraint
Skill: trigger + procedure outline

### 7. Validate usefulness

* Actionable?
* Specific?
* Non-duplicative?
* Improves future tasks?

### 8. Keep it minimal

* Prefer updating existing content
* Avoid unnecessary files
* Keep scope focused

## Output format

1. Task summary (1–2 lines)
2. Key learnings (bullet list)
3. Classification per learning
4. Decision (rule / skill / update / none)
5. Proposed content (short draft)
6. Optional: target file/location

## Core rules

* Capture learnings immediately after tasks
* Only store actionable, repeatable insights
* Prefer clarity over completeness
* Keep guidance minimal and focused
* Improve the system incrementally

## Gotchas

* Model tends to capture vague or useless learnings
* Model may over-create new skills instead of updating
* Small one-off issues may not justify new guidance
* Too many weak learnings create noise over time

## Do NOT

* Do NOT capture vague statements without action
* Do NOT create rules or skills for one-off issues
* Do NOT duplicate existing guidance
* Do NOT overcomplicate simple learnings

## Auto-trigger keywords

* after task
* learning
* retrospective
* what did we learn
* improve next time
* capture learning
* post-mortem
* post task

## Anti-patterns

* Capturing "that was hard" without concrete cause
* Creating a skill for every resolved bug
* Vague learning like "be more careful next time"
* Ignoring learnings because the task is done

## Examples

Task: Fix broken markdown output in generated templates
Learnings:
* Nested triple backticks break copyability
* Plain text is safer than markdown fences in templates
Decision: Update markdown rules + ensure markdown-safe skill exists

Task: Debug Laravel route detection
Learnings:
* route:list JSON is more reliable than table output
* jq filtering avoids parsing errors
Decision: Create skill for route inspection using JSON + jq

## Environment notes

Use immediately after completing meaningful tasks, while context is still fresh.
