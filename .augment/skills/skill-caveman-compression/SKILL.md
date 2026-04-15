---
name: skill-caveman-compression
description: "Use when compressing or simplifying skills to make them shorter, sharper, and more executable without losing quality."
source: project
---

# skill-caveman-compression

## When to use

* Skill too verbose
* Redundant explanations
* Feels like documentation, not execution guidance
* Converting uncompressed skill to compressed version

Do not use when skill is already short/clear, compression would remove critical logic, or content needs expansion first.

## Goal

* Shorter without weaker
* Better scanability and trigger quality
* Preserve execution-critical content
* Remove noise, not meaning

## Preconditions

* Source skill exists with enough structure
* Compressed version keeps same intent

## Decision hints

* Explains instead of guiding → compress or remove
* Two bullets say same thing → merge
* Paragraph → one bullet
* Compression removes validation/decisions → keep longer
* Section adds no execution value → delete
* No procedure/validation → fix structure first, then compress

## Procedure

### 0. Inspect

* Core job? Essential sections? Redundant/obvious lines?

### 1. Preserve critical skeleton

Always: When to use, Procedure, Output format, Core rules, Gotchas, Do NOT
If useful: Preconditions, Decision hints, Anti-patterns, Examples

### 2. Compress trigger

Good: "Creating reusable markdown templates"
Bad: "Use this skill when you may possibly be working on some kind of markdown-related output"

### 3. Compress decisions

Good: "Template contains code → avoid nested triple backticks"
Bad: "If there is code in the template, then it may be better to consider avoiding nested fences"

### 4. Compress procedure

Each step short and executable.

Good: 1. Inspect 2. Define structure 3. Insert examples 4. Validate
Bad: 1. Think about what user may want 2. Consider best structure 3. Check if seems okay

### 5. Strengthen validation

Good: No nested backticks / Entire content selectable / No broken rendering
Bad: Check if it works

### 6. Remove obvious content

Delete: "Laravel is a PHP framework", "README files document projects"
Keep only what model forgets, misuses, or executes badly.

### 7. Add anti-patterns if useful

Short patterns preventing recurring failures.

### 8. Compare before and after

Compressed must be: easier to scan, easier to trigger, easier to execute, at least as safe.
If not → revise.

## Output format

1. Compressed SKILL.md only
2. No explanations outside file
3. Same intent — shorter, sharper, more testable

## Core rules

* Execution quality > brevity
* Keep behavior-changing guidance
* Remove filler first
* Keep concrete validation
* Bullets over prose
* Direct instructions over paragraphs

## Gotchas

* Over-compression removes important nuance
* Removing validation makes skill weaker
* Some verbose examples are load-bearing
* Shorter ≠ better if trigger quality drops

## Do NOT

* Do NOT remove validation step
* Do NOT compress away decision hints
* Do NOT keep decorative prose
* Do NOT change core intent
* Do NOT merge unrelated workflows to save space

## Auto-trigger keywords

* compress skill, simplify skill, shorten skill
* caveman compress, reduce verbosity, optimize skill

## Anti-patterns

* Same idea repeated in Goal, Core rules, and Gotchas
* Long paragraphs where one bullet suffices
* Vague procedure steps
* Output format not controlling verbosity
* Compression deleting safety-critical checks

## Examples

Original: "Validate copy/paste safety"
Better: Validate → No nested backticks / Entire content selectable / No broken rendering

Original: "Use this skill when generating reusable markdown templates that may include code examples and should ideally remain stable across multiple rendering environments."
Better: "Generating reusable markdown templates" + "Output must be copy-paste safe"

## Environment notes

Compress uncompressed source first. Generate compressed from source.
Don't compress weak skills — fix structure first.
