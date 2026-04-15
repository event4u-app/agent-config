---
name: skill-writing
description: "Use when creating or improving agent skills. Covers structure, quality checklist, and best practices."
source: project
---

# skill-writing

## When to use

* Creating new skill from scratch
* Improving existing skill
* Reviewing skill quality
* Deciding skill vs rule

Do not use for rules (constraints, not workflows) or commands (direct invocations).

## Goal

* Executable skills, not documentation
* Every skill answers: When? How? What output?
* Prevent: too broad, too generic, missing validation

## Preconditions

* Clear understanding of intended task
* Distinction: rules = always apply, skills = triggered workflows
* Access to skill template or reference skill

## Decision hints

* "Always do X" → rule, not skill
* "When user asks Y, do steps 1-5" → skill
* Generic framework knowledge → skip
* Skill > 500 lines → split
* Multiple workflows → split into multiple skills
* Two skills overlap heavily → merge

## Procedure

### 0. Inspect input

* What exactly is requested?
* Similar skill exists?
* Scope too broad or unclear?

### 1. Define trigger

Write "When to use" first.

Good: Use when creating Laravel middleware for request filtering
Bad: Use when working with Laravel

### 2. Write procedure

Numbered, verifiable steps.

Good:
1. Check if middleware exists
2. Create with artisan command
3. Implement logic
4. Register in route or kernel

Bad:
1. Create middleware
2. Add logic

### 3. Add validation

Concrete checks at the end.

Good:
* Route returns expected status
* Appears in route list
* No static analysis errors

Bad:
* Check if it works

### 4. Add safe/unsafe example

Minimal contrast.

Good: Typed middleware, correctly registered
Bad: Business logic inside middleware

### 5. Define output format

Control response structure.

1. Code snippet
2. Registration location
3. Gotcha (if relevant)

### 6. Validate against quality checklist

* K1: Description is trigger ("Use when...")
* K2: Not over-defined
* K3: No obvious content
* K4: Contains gotchas
* K5: Under 500 lines

## Output format

1. Complete SKILL.md file
2. No explanations outside file
3. Fully copyable
4. No empty sections

## Core rules

* Skills are executable thinking processes
* Required: When to use, Procedure, Output format, Gotchas, Do NOT
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

* create skill, write skill, improve skill, skill template, SKILL.md

## Anti-patterns

* "Laravel skill" (too broad)
* Missing procedure
* Missing validation
* Pure explanation without actions

## Examples

Request: "Create a skill for database migrations"

Good: Clear trigger, concrete procedure, validation with commands
Bad: Generic description, no validation, missing output format

## Environment notes

Source: `.augment.uncompressed/skills/{name}/SKILL.md`
Compressed: `.augment/skills/{name}/SKILL.md`
