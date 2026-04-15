---
name: skill-writing
description: "Use when creating or improving agent skills. Covers structure, quality checklist, and the gold-standard format for SKILL.md files."
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

* Writing rules (rules are short constraints, not workflows)
* Writing commands (commands are step-by-step invocations)

## Goal

* Create skills that are executable, not just informative
* Ensure every skill answers: When? How? What does good output look like?
* Prevent common mistakes: too broad, too generic, missing procedure

## Preconditions

* Clear understanding of what the skill should do
* Know the difference: rules = always-apply constraints, skills = repeatable workflows
* Template available at `.augment/templates/skill-template.md`

## Decision hints

* If content is "always do X" → rule, not skill
* If content is "when user asks Y, do steps 1-5" → skill
* If content is general framework knowledge the model already knows → don't write it
* If a skill exceeds 500 lines → split into multiple skills
* If two skills overlap significantly → merge them

## Procedure

### 1. Define the trigger

Write the `When to use` section first. Be specific:

Good: "Use when creating Laravel middleware for request filtering"
Bad: "Use when working with Laravel"

### 2. Write the procedure

Numbered steps with concrete commands or actions. Each step should be independently verifiable.

Good:
1. Check if middleware exists
2. Create with `php artisan make:middleware X`
3. Implement handle()
4. Register in route or kernel

Bad:
1. Create middleware
2. Add logic
3. Done

### 3. Add validation to the last step

Always end the procedure with a validation step that has concrete checks:

Good:
5. Validate
   - Route responds with expected status code
   - Middleware appears in `php artisan route:list --json | jq`
   - No PHPStan errors

Bad:
5. Check if it works

### 4. Add a safe/unsafe example

One minimal example showing the difference:

Good output: middleware with typed parameters, registered in route group
Bad output: middleware with business logic, registered globally

### 5. Sharpen the output format

Define what the agent should respond with — prevents chatty answers:

Good: "1. Code snippet 2. Registration location 3. Gotcha if relevant"
Bad: "Explain everything about middleware"

### 6. Validate against the 5 Skill Killers

- K1: Description is a trigger (starts with "Use when...")
- K2: Not over-defined (guides, doesn't railroad)
- K3: No obvious content (model already knows)
- K4: Has Gotcha section (real failure patterns)
- K5: Under 500 lines

## Output format

1. Skill file with all required sections
2. No unnecessary prose
3. Every section earns its place — delete empty or obvious sections
4. Concrete examples over abstract descriptions

## Core rules

* Skills are executable thinking processes — not documentation
* Every skill must have: When to use, Procedure, Output format, Gotchas, Do NOT
* Procedure steps must be independently verifiable
* Validation step must have concrete checks, not "verify it works"
* One skill = one job. Not "everything about Laravel"
* Examples beat explanations

## Gotchas

* The model tends to write documentation instead of executable steps — always ask "can I follow this step by step?"
* The model tends to skip validation — always end with concrete checks
* The model tends to write obvious content like "Laravel is a PHP framework" — only write what the model wouldn't know from training
* Description field is loaded into every conversation — keep it under 200 chars and make it a trigger, not a summary

## Do NOT

* Do NOT write skills that are just framework documentation
* Do NOT skip the Procedure section
* Do NOT write validation as "check if it works" — be specific
* Do NOT exceed 500 lines — split instead
* Do NOT duplicate content from rules or guidelines

## Auto-trigger keywords

* create skill
* write skill
* improve skill
* skill template
* skill quality
* SKILL.md
* new skill

## Examples

Example request: "Create a skill for database migrations"

Good skill structure:
- When: "Use when creating or running Laravel migrations"
- Procedure: 1. Check existing migrations 2. Create with artisan 3. Define schema 4. Run migrate 5. Validate with `php artisan migrate:status`
- Output: Migration file + confirmation of successful run
- Gotcha: "Model tends to forget foreign key constraints on delete"

Bad skill structure:
- When: "Use for database stuff"
- Procedure: 1. Create migration 2. Run it
- Output: (missing)
- Gotcha: (missing)

## Environment notes

Skills live in `.augment.uncompressed/skills/{name}/SKILL.md` (source of truth).
Compressed copies in `.augment/skills/{name}/SKILL.md`.
Compression happens before commit/push via `/compress`.
