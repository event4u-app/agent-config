---
name: skill-writing
description: "Use when creating or improving agent skills. Covers structure, quality checklist, and best practices."
source: project
---

# skill-writing

## When to use

Use this skill when:

* Creating a new skill from scratch
* Improving an existing skill
* Reviewing skill quality
* Deciding what belongs in a skill vs a rule

Typical examples:

* "Create a skill for X"
* "This skill needs improvement"
* "Should this be a skill or a rule?"

Do not use this skill when:

* Writing rules (rules are constraints, not workflows)
* Writing commands (commands are direct invocations)

## Goal

* Create executable skills, not documentation
* Ensure every skill answers: When? How? What output?
* Prevent common mistakes: too broad, too generic, missing validation

## Preconditions

* Clear understanding of the intended task
* Distinction: rules = always apply, skills = triggered workflows
* Access to a skill template or existing reference skill

## Decision hints

* If content is "always do X" → rule, not skill
* If content is "when user asks Y, do steps 1-5" → skill
* If content is generic framework knowledge → skip it
* If skill > 500 lines → split
* If multiple workflows exist → split into multiple skills
* If two skills overlap heavily → merge

## Procedure

### 0. Inspect the input

* What exactly is being requested?
* Does a similar skill already exist?
* Is the scope too broad or unclear?

### 1. Define the trigger

Write "When to use" first.

Good:
Use when creating Laravel middleware for request filtering

Bad:
Use when working with Laravel

### 2. Write the procedure

Use numbered, verifiable steps.

Good:

1. Check if middleware exists
2. Create with artisan command
3. Implement logic
4. Register in route or kernel

Bad:

1. Create middleware
2. Add logic

### 3. Add validation

End with concrete validation.

Good:

* Route returns expected status
* Appears in route list
* No static analysis errors

Bad:

* Check if it works

### 4. Add safe/unsafe example

Show minimal contrast.

Good:

* Typed middleware, correctly registered

Bad:

* Business logic inside middleware

### 5. Define output format

Control response structure.

Example:

1. Code snippet
2. Registration location
3. Gotcha (if relevant)

### 6. Validate against quality checklist

* K1: Description is a trigger ("Use when...")
* K2: Not over-defined
* K3: No obvious content
* K4: Contains gotchas
* K5: Under 500 lines

## Output format

1. Complete SKILL.md file
2. No explanations outside the file
3. Fully copyable
4. No empty sections

## Core rules

* Skills are executable thinking processes
* Always include: When to use, Procedure, Output format, Gotchas, Do NOT
* Steps must be verifiable
* Validation must be concrete
* One skill = one job

## Gotchas

* Model writes documentation instead of steps
* Model skips validation
* Model includes obvious knowledge
* Description too long or not a trigger

## Do NOT

* Do NOT write documentation-style skills
* Do NOT skip Procedure
* Do NOT use vague validation
* Do NOT exceed 500 lines
* Do NOT duplicate rules

## Auto-trigger keywords

* create skill
* write skill
* improve skill
* skill template
* SKILL.md

## Anti-patterns

* "Laravel skill" (too broad)
* Missing procedure
* Missing validation
* Pure explanation without actions

## Examples

Request:
"Create a skill for database migrations"

Good:

* Clear trigger
* Concrete procedure
* Validation with commands

Bad:

* Generic description
* No validation
* Missing output format

## Environment notes

Skills live in:
.augment.uncompressed/skills/{name}/SKILL.md

Compressed:
.augment/skills/{name}/SKILL.md
