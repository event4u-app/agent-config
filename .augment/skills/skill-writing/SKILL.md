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

## Decision matrix: What goes where?

Before creating anything, classify:

| If content is... | Then... | Action |
|---|---|---|
| Always-true constraint ("never X", "always Y") | **Rule** | Create/update `.augment/rules/` |
| Step-by-step workflow with decisions and validation | **Skill** | Create/update `.augment/skills/` |
| Coding convention or reference material | **Guideline** | Create/update `.augment/guidelines/` |
| Baseline model knowledge (how jq works, what `docker exec` does) | **Nothing** | Do not create anything |
| Simple tool usage without complex workflow | **Nothing** | Do not create anything |
| Already covered by existing skill/rule/guideline | **Update** | Extend existing file |

### Critical test

Ask: **"Does the model need this to do its job correctly?"**

* Model already knows it → **Nothing**
* Model knows it but does it wrong in THIS project → **Rule or Guideline**
* Model needs multi-step workflow to get it right → **Skill**

### When "Nothing" is the right answer

Do NOT create skill or rule for:
* Standard tool usage (jq, grep, docker exec, git commands)
* Framework basics the model already knows
* Single-command operations without decision logic
* Knowledge that belongs in a skill's procedure as a step, not its own skill

### Size and structure hints

* Skill > 500 lines → split
* Multiple workflows → split into multiple skills
* Two skills overlap heavily → merge
* Skill becomes "read the guideline" → lost its purpose, restore workflow

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

* Vague statements like "see if outcome is correct" (no concrete command or assertion)

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
* K5: Has Output format (numbered, 2-4 deliverables)
* K6: Under 500 lines

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

### When to create a `project-analysis-*` skill

A framework gets its own analysis skill ONLY if:

* it has its own lifecycle that creates unique debugging patterns
* it produces failure classes that `project-analysis-core` cannot explain
* debugging it requires framework-specific mental models

✅ Qualifies: Laravel, Symfony, Express, React, Next.js
❌ Does NOT qualify: Tailwind, utility libs, CSS frameworks, simple state managers

## Gotchas

* Model writes documentation instead of steps
* Model skips validation — every Procedure MUST end with a concrete verify/confirm step
* Model includes obvious knowledge
* Description too long or not a trigger
* Renaming an existing heading to "Procedure:" without adding ordered steps creates false structure — the linter requires numbered steps or `###` sub-headings
* **Always run `python3 scripts/skill_linter.py` on the new skill** — must be 0 FAIL before saving

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
