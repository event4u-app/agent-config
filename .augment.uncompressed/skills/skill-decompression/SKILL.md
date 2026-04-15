---
name: skill-decompression
description: "Use when expanding a compressed skill into a full, clear, and maintainable source-of-truth version."
source: project
---

# skill-decompression

## When to use

Use this skill when:

* A skill is too compressed or hard to understand
* Creating or updating the uncompressed source-of-truth version
* Preparing skills for long-term maintenance or team usage
* A compressed skill lacks clarity, context, or examples

Do not use this skill when:

* The skill is already clear, structured, and maintainable
* The goal is to shorten or simplify (use compression instead)
* The skill is still incomplete and needs initial creation first

## Goal

* Expand compressed skills into clear, maintainable versions
* Restore readability, structure, and intent
* Add missing context without adding noise
* Preserve execution quality while improving understanding

## Preconditions

* A compressed or minimal skill exists
* The intent of the skill is still clear
* The expanded version will be used as source-of-truth

## Decision hints

* If a bullet hides important reasoning → expand it
* If a step is unclear → add minimal explanation
* If validation is too short → make checks explicit
* If structure is missing → restore full sections
* If expansion adds only noise → do not expand

## Procedure

### 0. Inspect the compressed skill

Check:
* What is the core purpose?
* Which parts are unclear or too condensed?
* Which sections are missing or incomplete?

### 1. Restore full structure

Ensure these sections exist:
* When to use, Goal, Preconditions, Decision hints
* Procedure, Output format, Core rules
* Gotchas, Do NOT

Optional: Examples, Anti-patterns, Environment notes

### 2. Expand the trigger

Make "When to use" clearer and slightly more descriptive.

Good: "Creating reusable markdown templates for README or SKILL.md files"
Bad: "markdown templates"

### 3. Expand the procedure

Turn compressed steps into clearer actions.

Good:
1. Inspect requirements (type, audience, constraints)
2. Define structure (sections, headings)
3. Insert examples safely (no nested fences)
4. Validate copyability

Bad:
1. Inspect
2. Structure
3. Validate

### 4. Strengthen validation

Make validation explicit and testable.

Good:
* No nested triple backticks
* Entire content selectable
* No rendering issues in plain markdown

Bad:
* Check if it works

### 5. Add minimal explanations where needed

Only where it improves execution:
* clarify edge cases
* explain non-obvious constraints
* highlight common mistakes

Avoid: generic framework explanations, obvious knowledge

### 6. Add examples if missing

Include minimal good/bad example. Focus on real failure patterns.

### 7. Keep balance

Expanded version should be: clearer, still executable, not significantly noisier.
If expansion reduces clarity → revert or simplify.

## Output format

1. Full SKILL.md file
2. No missing sections
3. Clear, readable, and structured
4. Still executable (not documentation-heavy)

## Core rules

* Expand for clarity, not verbosity
* Keep execution quality intact
* Add context only where it helps decisions
* Preserve original intent
* Prefer clarity over compression when in doubt

## Gotchas

* Over-expansion can turn skills into documentation
* Adding too much explanation reduces usability
* Losing structure during expansion makes skills inconsistent
* Expanding obvious content creates noise

## Do NOT

* Do NOT add generic framework explanations
* Do NOT expand everything blindly
* Do NOT change the core purpose of the skill
* Do NOT remove concrete validation
* Do NOT introduce verbosity without value

## Auto-trigger keywords

* expand skill
* decompress skill
* improve readability
* make skill clearer
* restore full skill
* uncompressed skill

## Anti-patterns

* Expanding every bullet into a paragraph
* Adding obvious knowledge (e.g. "Markdown uses headings")
* Losing step-by-step execution clarity
* Mixing explanation with procedure steps

## Examples

Compressed: "Validate → No nested triple backticks / Fully selectable"

Expanded:
5. Validate copy/paste safety
   * No nested triple backticks
   * Entire content is fully selectable
   * No rendering issues in plain markdown view

Compressed: "Template contains code → avoid triple backticks"

Expanded: "If the template contains code → avoid nested triple backtick fences to prevent broken markdown rendering"

## Environment notes

Use this skill to maintain the uncompressed source of truth.
Compressed versions should be derived from this version, not the other way around.
