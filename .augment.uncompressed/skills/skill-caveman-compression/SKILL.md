---
name: skill-caveman-compression
description: "Use when compressing or simplifying skills to make them shorter, sharper, and more executable without losing quality."
source: project
---

# skill-caveman-compression

## When to use

Use this skill when:

* A skill is too verbose
* A skill contains redundant explanations
* A skill feels more like documentation than execution guidance
* Converting an uncompressed skill into a compressed version

Do not use this skill when:

* The skill is already short, clear, and executable
* Compression would remove important decision logic or validation
* The content is still incomplete and needs expansion first

## Goal

* Make skills shorter without making them weaker
* Improve scanability and trigger quality
* Preserve execution-critical content
* Remove noise, not meaning

## Preconditions

* A source skill already exists
* The skill has enough structure to evaluate
* Compressed version must keep the same intent as the original

## Decision hints

* Sentence explains instead of guiding → compress or remove
* Two bullets say the same thing → merge
* Paragraph can become one bullet → rewrite
* Compression removes validation or decision quality → keep longer version
* Section adds no execution value → delete
* Skill has no procedure or validation → fix structure first, then compress

## Procedure

### 0. Inspect the skill

* What is the core job?
* Which sections are essential?
* Which lines are redundant, obvious, or verbose?

### 1. Preserve the critical skeleton

Always keep:

* When to use
* Procedure
* Output format
* Core rules
* Gotchas
* Do NOT

Keep if useful:

* Preconditions
* Decision hints
* Anti-patterns
* Examples

### 2. Compress the trigger

Rewrite description and "When to use" for fast matching.

Good: "Creating reusable markdown templates"
Bad: "Use this skill when you may possibly be working on some kind of markdown-related output"

### 3. Compress decision logic

Turn explanations into direct choices.

Good: "Template contains code → avoid nested triple backticks"
Bad: "If there is code in the template, then it may be better to consider avoiding nested fences"

### 4. Compress the procedure

Each step short and executable.

Good:
1. Inspect requirements
2. Define structure
3. Insert examples safely
4. Validate copyability

Bad:
1. Think about what the user may want
2. Consider the best possible structure
3. Try to add some examples
4. Check if it seems okay

### 5. Strengthen validation

Compression must not weaken validation.

Good:
* No nested triple backticks
* Entire content selectable
* No broken rendering in plain markdown view

Bad:
* Check if it works

### 6. Remove obvious content

Delete lines like:
* "Laravel is a PHP framework"
* "README files document projects"

Keep only what the model is likely to forget, misuse, or execute badly.

### 7. Add anti-patterns if useful

Short anti-patterns prevent recurring failures:
* Missing validation
* Skill too broad
* Same idea repeated across Goal, Core rules, and Gotchas

### 8. Compare before and after

The compressed version must be:
* Easier to scan
* Easier to trigger
* Easier to execute
* At least as safe as the original

If not → revise.

## Output format

1. Compressed SKILL.md only
2. No explanations outside file unless requested
3. Same intent as original
4. Shorter, sharper, more testable

## Core rules

* Compress for execution quality, not just brevity
* Keep behavior-changing guidance
* Remove filler first
* Keep concrete validation
* Prefer bullets over prose
* Prefer direct instructions over explanatory paragraphs

## Gotchas

* Over-compression removes important nuance
* Removing validation makes skill weaker
* Some examples look verbose but are load-bearing
* Shorter is not better if trigger quality drops

## Do NOT

* Do NOT remove the validation step
* Do NOT compress away decision hints that prevent mistakes
* Do NOT keep decorative prose
* Do NOT change the skill's core intent
* Do NOT merge unrelated workflows to save space

## Auto-trigger keywords

* compress skill
* simplify skill
* shorten skill
* caveman compress
* reduce verbosity
* make skill sharper
* optimize skill

## Anti-patterns

* Same idea repeated in Goal, Core rules, and Gotchas
* Long paragraphs where one bullet would do
* Vague procedure steps
* Output format that does not control verbosity
* Compression that deletes safety-critical checks

## Examples

Original: "Validate copy/paste safety"

Better compressed:
* Validate
  * No nested triple backticks
  * Entire content selectable
  * No broken rendering in plain markdown view

Original: "Use this skill when generating reusable markdown templates that may include code examples and should ideally remain stable across multiple rendering environments."

Better compressed:
* Generating reusable markdown templates
* Output must be copy-paste safe

## Environment notes

Use on uncompressed source first.
Generate compressed version from that source.
Do not compress weak skills without fixing structure first.
