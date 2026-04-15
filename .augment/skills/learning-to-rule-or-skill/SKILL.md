---
name: learning-to-rule-or-skill
description: "Use when a repeated learning, mistake, or successful pattern should be turned into a new rule or skill."
source: project
---

# learning-to-rule-or-skill

## When to use

* Repeated mistake across multiple tasks
* Successful pattern to reuse
* New constraint or workflow to capture permanently
* Post-task retrospectives
* Deciding: rule vs skill vs update

Do not use for one-off problems, vague issues, or content already covered by existing guidance.

## Goal

* Turn repeated learnings into reusable guidance
* Decide correctly: rule, skill, or update
* Prevent same mistakes recurring
* Keep system small and non-duplicative

## Preconditions

* Concrete learning exists (statable in 1-2 sentences)
* Existing rules/skills can be checked for overlap

## Decision hints

* Always-apply constraint → rule
* Repeatable workflow with steps → skill
* Refines existing guidance → update, not new file
* One-off or too narrow → no action
* Same issue appeared 2+ times → codify

## Procedure

### 1. State learning clearly

Good: "Nested triple backticks break copyability in generated markdown"
Bad: "Markdown is annoying"

### 2. Classify pattern type

Constraint / Workflow / Anti-pattern / Quality check / Environment convention

### 3. Decide target

New rule / Update rule / New skill / Update skill / No action

### 4. Check overlap

Similar rule exists? Similar skill? Small update better than new file?

### 5. Draft content

Rule: short, durable constraint — general, always applicable
Skill: focused workflow with When to use, Procedure, Output format, Gotchas, Do NOT

### 6. Validate usefulness

* Improves future outputs?
* Specific enough to act on?
* Different from existing?
* Matters more than once?

### 7. Smallest effective change

Update over duplicate. Small skill over broad. Short rule over long.

## Output format

1. Learning summary
2. Decision: rule / skill / update / no action
3. Rationale (1-3 lines)
4. Proposed content
5. Optional: target filename

## Core rules

* Capture repeated patterns, not random observations
* Update existing over creating duplicates
* Rules = durable constraints
* Skills = repeatable workflows
* Smallest possible guidance

## Gotchas

* Model creates new files when small update suffices
* Vague frustrations become bad guidance
* Documentation instead of reusable instructions
* Over-capturing weak learnings = noise

## Do NOT

* Do NOT create for one-off problems
* Do NOT duplicate existing guidance
* Do NOT create broad catch-all skills
* Do NOT write vague learnings without concrete consequence

## Auto-trigger keywords

* learning, retrospective, repeated mistake, recurring issue
* create rule from learning, create skill from learning
* codify this, capture this pattern

## Anti-patterns

* Skill for every minor annoyance
* Rule saying "be careful" without concrete constraint
* Duplicate with slightly different wording
* Capturing before it has repeated

## Examples

"Nested backticks broke copyability twice" → Update markdown rule + add skill if missing
"Route checks fail with text parsing" → Create focused route-inspection skill
"Forgot PHPStan once" → No action — one-off, already covered

## Environment notes

Prefer updating existing. New files only for clearly distinct patterns.
