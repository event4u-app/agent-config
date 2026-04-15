---
name: learning-to-rule-or-skill
description: "Use when a repeated learning, mistake, or successful pattern should be turned into a new rule or skill."
source: project
---

# learning-to-rule-or-skill

## When to use

Use this skill when:

* A repeated mistake appears across multiple tasks
* A successful pattern should be reused in the future
* A new constraint or workflow should be captured permanently
* Reviewing post-task learnings or retrospectives
* Deciding whether a learning belongs in a rule or a skill

Do not use this skill when:

* The learning is one-off and unlikely to repeat
* The issue is too vague to turn into guidance
* The content already exists in an equivalent rule or skill

## Goal

* Turn repeated learnings into reusable project guidance
* Decide correctly between rule, skill, or update to an existing one
* Prevent the same mistakes from happening again
* Keep the system small, clear, and non-duplicative

## Preconditions

* A concrete learning, mistake, or successful pattern exists
* The learning can be stated clearly in one or two sentences
* Existing rules and skills can be checked for overlap

## Decision hints

* Always-apply constraint → create or update a rule
* Repeatable workflow with steps → create or update a skill
* Only refines existing rule/skill → update instead of new file
* One-off or too narrow → do not create anything yet
* Same issue appeared at least twice → strongly consider codifying

## Procedure

### 1. State the learning clearly

Write as a concrete sentence.

Good:
* Nested triple backticks break copyability in generated markdown
* Route inspection is more reliable via JSON and jq than text parsing

Bad:
* Markdown is annoying
* Routing was confusing

### 2. Identify the pattern type

Classify:
* Constraint
* Workflow
* Anti-pattern
* Quality check
* Environment-specific convention

### 3. Decide the target

Choose one:
* New rule
* Update existing rule
* New skill
* Update existing skill
* No action

### 4. Check for overlap

* Does a similar rule already exist?
* Does a similar skill already exist?
* Would a small update be better than a new file?

### 5. Draft the content

If rule:
* Short, durable constraint
* General, clear, always applicable

If skill:
* Focused workflow
* Include: When to use, Procedure, Output format, Gotchas, Do NOT

### 6. Validate usefulness

* Will this improve future outputs?
* Specific enough to act on?
* Different from existing guidance?
* Likely to matter more than once?

### 7. Keep only the smallest effective change

Prefer:
* Update over duplicate
* Small focused skill over broad skill
* Short rule over long rule

## Output format

1. Learning summary
2. Decision: rule, skill, update, or no action
3. Rationale in one to three lines
4. Proposed content
5. Optional: target filename

## Core rules

* Capture repeated patterns, not random observations
* Prefer updating existing guidance over creating duplicates
* Rules are for durable constraints
* Skills are for repeatable workflows
* Keep new guidance as small and focused as possible

## Gotchas

* Model tends to create new files when a small update is enough
* Model tends to turn vague frustrations into bad guidance
* Model may write documentation instead of reusable instructions
* Over-capturing weak learnings creates noise and reduces quality

## Do NOT

* Do NOT create a rule or skill for one-off problems
* Do NOT duplicate existing guidance
* Do NOT create broad "catch-all" skills
* Do NOT write vague learnings without a concrete behavioral consequence

## Auto-trigger keywords

* learning
* retrospective
* repeated mistake
* recurring issue
* create rule from learning
* create skill from learning
* codify this
* capture this pattern

## Anti-patterns

* Creating a skill for every minor annoyance
* Rule that says "be careful" without concrete constraint
* Skill that duplicates an existing one with slightly different wording
* Capturing a learning before it has repeated

## Examples

Learning: "Nested triple backticks broke markdown copyability twice this week."
Decision: Update existing markdown rule + add markdown-safe skill if none exists.

Learning: "Route checks keep failing when done via text parsing."
Decision: Create focused skill for Laravel route inspection via JSON and jq.

Learning: "I forgot to run PHPStan once."
Decision: No action — one-off, already covered by verify-before-complete rule.

## Environment notes

Prefer updating existing rule/skill when possible.
Create new files only when the learning introduces a clearly distinct pattern.
