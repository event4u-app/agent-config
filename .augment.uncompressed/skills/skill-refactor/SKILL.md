---
name: skill-refactor
description: "Use when improving or restructuring existing skills to match best practices and increase clarity and execution quality."
source: project
---

# skill-refactor

## When to use

Use this skill when:

* A skill is unclear or too verbose
* A skill lacks structure or validation
* A skill is too broad or inconsistent
* Migrating old skills to new standards

Do not use this skill when:

* Creating a new skill from scratch (use skill-writing)
* Only compressing without restructuring (use skill-caveman-compression)
* Only validating without changing (use skill-validator)

## Goal

* Improve clarity and execution quality
* Align skill with best practices
* Reduce noise and increase usefulness

## Preconditions

* Existing skill is available
* Issues or weaknesses are identified

## Decision hints

* If too long → simplify or split
* If too generic → narrow scope
* If missing validation → add it
* If unclear → rewrite sections
* If multiple workflows → split into separate skills

## Procedure

### 0. Inspect current skill

* Identify missing sections
* Detect weak areas
* Check for anti-patterns
* Understand the original intent before changing anything

### 1. Clean structure

Ensure required sections:

* When to use (with "Do not use")
* Procedure (numbered, verifiable steps)
* Output format
* Gotchas
* Do NOT

### 2. Improve procedure

* Make steps concrete and actionable
* Ensure each step is verifiable
* Add validation as final step with concrete checks

### 3. Remove noise

* Delete obvious or redundant content
* Remove generic framework explanations
* Merge bullets that say the same thing

### 4. Refine scope

* Ensure single responsibility
* Split if multiple workflows exist
* Add "Do not use" to prevent false triggers

### 5. Add examples

* Minimal good vs bad example
* Focus on real failure patterns

### 6. Compare before and after

The refactored version must be:
* Clearer than the original
* At least as executable
* Not broader in scope

If not → revise.

## Output format

1. Refactored SKILL.md
2. No explanations outside the file
3. Clean and consistent structure

## Core rules

* Keep skills minimal and focused
* Remove unnecessary content
* Improve execution clarity
* Prefer examples over explanations
* Preserve original intent

## Gotchas

* Over-refactoring can remove useful context
* Splitting skills incorrectly can reduce usability
* Removing too much can break understanding
* Changing intent instead of improving structure

## Do NOT

* Do NOT rewrite without understanding intent
* Do NOT expand scope
* Do NOT remove validation
* Do NOT merge unrelated workflows

## Auto-trigger keywords

* refactor skill
* improve skill
* rewrite skill
* optimize skill
* clean skill

## Anti-patterns

* Refactoring scope instead of structure
* Removing gotchas because they "look verbose"
* Adding sections without execution value
* Changing the trigger while refactoring internals

## Examples

Request: "This skill is too verbose and unclear"

Good refactor:
* Identified 3 redundant sections → merged
* Added missing validation step
* Narrowed trigger to specific use case
* Result: 40% shorter, clearer procedure

Bad refactor:
* Rewrote everything from scratch
* Changed the skill's purpose
* Removed gotchas and examples
