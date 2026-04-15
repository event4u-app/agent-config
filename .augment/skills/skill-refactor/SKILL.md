---
name: skill-refactor
description: "Use when improving or restructuring existing skills to match best practices and increase clarity and execution quality."
source: project
---

# skill-refactor

## When to use

* Skill unclear or too verbose
* Lacks structure or validation
* Too broad or inconsistent
* Migrating old skills to new standards

Do not use for creating new skills (use skill-writing), compressing only (use skill-caveman-compression), or validating only (use skill-validator).

## Goal

* Improve clarity and execution quality
* Align with best practices
* Reduce noise, increase usefulness

## Preconditions

* Existing skill available
* Issues or weaknesses identified

## Decision hints

* Too long → simplify or split
* Too generic → narrow scope
* Missing validation → add it
* Unclear → rewrite sections
* Multiple workflows → split

## Procedure

### 0. Inspect current skill

* Missing sections? Weak areas? Anti-patterns?
* Understand original intent before changing

### 1. Clean structure

Required: When to use (with "Do not use"), Procedure (numbered, verifiable), Output format, Gotchas, Do NOT

### 2. Improve procedure

* Steps concrete and actionable
* Each step verifiable
* Validation as final step with concrete checks

### 3. Remove noise

* Delete obvious/redundant content
* Remove generic framework explanations
* Merge bullets saying same thing

### 4. Refine scope

* Single responsibility
* Split if multiple workflows
* Add "Do not use" for false trigger prevention

### 5. Add examples

Minimal good/bad example. Focus on real failure patterns.

### 6. Compare before and after

Refactored must be: clearer, at least as executable, not broader. If not → revise.

## Output format

1. Refactored SKILL.md — no explanations outside file — clean structure

## Core rules

* Minimal and focused
* Remove unnecessary content
* Improve execution clarity
* Examples over explanations
* Preserve original intent

## Gotchas

* Over-refactoring removes useful context
* Incorrect splitting reduces usability
* Removing too much breaks understanding
* Changing intent instead of improving structure

## Do NOT

* Do NOT rewrite without understanding intent
* Do NOT expand scope
* Do NOT remove validation
* Do NOT merge unrelated workflows

## Auto-trigger keywords

* refactor skill, improve skill, rewrite skill, optimize skill, clean skill

## Anti-patterns

* Refactoring scope instead of structure
* Removing gotchas because they "look verbose"
* Adding sections without execution value
* Changing trigger while refactoring internals

## Examples

Good refactor: Identified 3 redundant sections → merged, added validation, narrowed trigger → 40% shorter, clearer
Bad refactor: Rewrote everything, changed purpose, removed gotchas and examples
