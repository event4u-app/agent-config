---
name: skill-decompression
description: "Use when expanding a compressed skill into a full, clear, and maintainable source-of-truth version."
source: project
---

# skill-decompression

## When to use

* Skill too compressed or hard to understand
* Creating/updating uncompressed source-of-truth
* Preparing skills for maintenance or team usage
* Compressed skill lacks clarity, context, or examples

Do not use when skill is already clear, goal is to shorten (use compression), or content needs initial creation first.

## Goal

* Expand into clear, maintainable versions
* Restore readability, structure, intent
* Add missing context without noise
* Preserve execution quality

## Preconditions

* Compressed or minimal skill exists
* Intent still clear
* Expanded version becomes source-of-truth

## Decision hints

* Bullet hides reasoning → expand
* Step unclear → add minimal explanation
* Validation too short → make checks explicit
* Structure missing → restore full sections
* Expansion adds only noise → do not expand

## Procedure

### 0. Inspect compressed skill

* Core purpose? Unclear parts? Missing sections?

### 1. Restore full structure

Required: When to use, Goal, Preconditions, Decision hints, Procedure, Output format, Core rules, Gotchas, Do NOT
Optional: Examples, Anti-patterns, Environment notes

### 2. Expand trigger

Good: "Creating reusable markdown templates for README or SKILL.md files"
Bad: "markdown templates"

### 3. Expand procedure

Good: 1. Inspect requirements (type, audience, constraints) 2. Define structure 3. Insert examples safely 4. Validate
Bad: 1. Inspect 2. Structure 3. Validate

### 4. Strengthen validation

Good: No nested backticks / Entire content selectable / No rendering issues
Bad: Check if it works

### 5. Add minimal explanations

Only where it improves execution: edge cases, non-obvious constraints, common mistakes.
Avoid: generic framework explanations, obvious knowledge.

### 6. Add examples if missing

Minimal good/bad example. Focus on real failure patterns.

### 7. Keep balance

Clearer, still executable, not noisier. If expansion reduces clarity → revert.

## Output format

1. Full SKILL.md — no missing sections
2. Clear, readable, structured
3. Still executable (not documentation-heavy)

## Core rules

* Expand for clarity, not verbosity
* Keep execution quality intact
* Context only where it helps decisions
* Preserve original intent
* Clarity over compression when in doubt

## Gotchas

* Over-expansion turns skills into documentation
* Too much explanation reduces usability
* Losing structure makes skills inconsistent
* Expanding obvious content creates noise

## Do NOT

* Do NOT add generic framework explanations
* Do NOT expand everything blindly
* Do NOT change core purpose
* Do NOT remove concrete validation
* Do NOT introduce verbosity without value

## Auto-trigger keywords

* expand skill, decompress skill, improve readability
* make skill clearer, restore full skill, uncompressed skill

## Anti-patterns

* Expanding every bullet into paragraph
* Adding obvious knowledge
* Losing step-by-step execution clarity
* Mixing explanation with procedure steps

## Examples

Compressed: "Validate → No nested backticks / Fully selectable"
Expanded: Validate copy/paste safety → No nested backticks / Entire content selectable / No rendering issues

Compressed: "Template contains code → avoid triple backticks"
Expanded: "If template contains code → avoid nested triple backtick fences to prevent broken markdown rendering"

## Environment notes

Maintain uncompressed source of truth. Compressed versions derived from this, not the other way around.
