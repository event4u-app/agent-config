---
name: skill-writing
description: "Use when creating or improving agent skills. Covers structure, quality checklist, and the gold-standard format for SKILL.md files."
source: project
---

# skill-writing

## When to use

* Creating new skill from scratch
* Improving existing skill
* Reviewing skill quality
* Deciding skill vs rule

Do not use for writing rules (short constraints) or commands (step-by-step invocations).

## Goal

* Skills that are executable, not just informative
* Every skill answers: When? How? What does good output look like?
* Prevent: too broad, too generic, missing procedure

## Preconditions

* Clear understanding of skill purpose
* Know difference: rules = always-apply constraints, skills = repeatable workflows
* Template at `.augment/templates/skill-template.md`

## Decision hints

* "Always do X" → rule, not skill
* "When user asks Y, do steps 1-5" → skill
* General framework knowledge model already knows → don't write it
* Exceeds 500 lines → split
* Two skills overlap → merge

## Procedure

### 1. Define trigger

Write `When to use` first. Be specific:

Good: "Use when creating Laravel middleware for request filtering"
Bad: "Use when working with Laravel"

### 2. Write procedure

Numbered steps with concrete commands/actions. Each step independently verifiable.

Good:
1. Check if middleware exists
2. Create with `php artisan make:middleware X`
3. Implement handle()
4. Register in route or kernel

Bad:
1. Create middleware
2. Add logic
3. Done

### 3. Add validation (last step)

Concrete checks, not "verify it works":

Good:
5. Validate
   - Route responds with expected status code
   - Middleware appears in `php artisan route:list --json | jq`
   - No PHPStan errors

Bad:
5. Check if it works

### 4. Add safe/unsafe example

One minimal example showing the difference:

Good output: middleware with typed parameters, registered in route group
Bad output: middleware with business logic, registered globally

### 5. Sharpen output format

Define what agent responds with — prevents chatty answers:

Good: "1. Code snippet 2. Registration location 3. Gotcha if relevant"
Bad: "Explain everything about middleware"

### 6. Validate against 5 Skill Killers

- K1: Description is trigger (starts with "Use when...")
- K2: Not over-defined (guides, doesn't railroad)
- K3: No obvious content (model already knows)
- K4: Has Gotcha section (real failure patterns)
- K5: Under 500 lines

## Output format

1. Skill file with all required sections
2. No unnecessary prose
3. Every section earns its place — delete empty/obvious sections
4. Concrete examples over abstract descriptions

## Core rules

* Skills are executable thinking processes — not documentation
* Required sections: When to use, Procedure, Output format, Gotchas, Do NOT
* Procedure steps independently verifiable
* Validation must have concrete checks
* One skill = one job
* Examples beat explanations

## Gotchas

* Model writes documentation instead of executable steps — ask "can I follow this step by step?"
* Model skips validation — always end with concrete checks
* Model writes obvious content ("Laravel is a PHP framework") — only project-specific conventions
* Description loaded into every conversation — under 200 chars, trigger not summary

## Do NOT

* Do NOT write skills that are just framework documentation
* Do NOT skip Procedure section
* Do NOT write validation as "check if it works" — be specific
* Do NOT exceed 500 lines — split instead
* Do NOT duplicate content from rules or guidelines

## Auto-trigger keywords

* create skill, write skill, improve skill, skill template
* skill quality, SKILL.md, new skill

## Examples

Request: "Create a skill for database migrations"

Good:
- When: "Use when creating or running Laravel migrations"
- Procedure: 1. Check existing 2. Create with artisan 3. Define schema 4. Run migrate 5. Validate with `php artisan migrate:status`
- Gotcha: "Model tends to forget foreign key constraints on delete"

Bad:
- When: "Use for database stuff"
- Procedure: 1. Create migration 2. Run it
- Gotcha: (missing)

## Environment notes

Skills live in `.augment.uncompressed/skills/{name}/SKILL.md` (source of truth).
Compressed copies in `.augment/skills/{name}/SKILL.md`.
Compression before commit/push via `/compress`.
