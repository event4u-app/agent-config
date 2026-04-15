---
name: markdown-template-generator
description: "Use when generating reusable markdown templates (README, docs, configs) that must be copy-paste safe."
source: project
---

# markdown-template-generator

## When to use

* Creating reusable markdown templates
* Generating documentation structures
* Building SKILL.md, README.md, or config templates
* Output must be directly copyable

Do not use for regular documentation (not a template) or inline code only.

## Goal

* Clean, reusable markdown templates
* Copy/paste works without breaking formatting

## Preconditions

* Output is markdown
* Template may include code or commands
* Stable across ChatGPT, GitHub, VSCode

## Decision hints

* Template contains code → avoid triple backticks nesting
* Unsure → plain text instead of code fences
* Readability over fancy formatting

## Procedure

### 0. Inspect requirements

* Template type? (skill, readme, config)
* Needs code examples?
* Target audience?

### 1. Define structure

Headings, sections, logical flow.

### 2. Add placeholders

Use [value], {VAR}, or {description} consistently.

### 3. Insert examples safely

WITHOUT nested backtick fences. Use indentation or ~~~ if needed.

### 4. Validate

* No nested triple backticks
* Entire content fully selectable
* No broken rendering in plain markdown view

## Output format

1. Template only — no explanations unless requested
2. Fully copyable — no prose around template

## Core rules

* Never nest triple backticks
* Plain text for commands
* Consistent section structure
* Templates minimal and reusable

## Gotchas

* Nested code blocks break copy/paste
* Markdown rendering differs across tools
* Over-formatting reduces usability

## Do NOT

* Do NOT use nested backtick fences
* Do NOT mix markdown styles inconsistently
* Do NOT generate non-copyable templates

## Auto-trigger keywords

* template, markdown template, README template, docs template, generate template

## Anti-patterns

* Template wrapped in triple backtick fence
* Placeholders without consistent format
* Missing sections with no indication to fill in

## Examples

Good:

    ## When to use
    * {scenario 1}
    * {scenario 2}

Bad: template with nested triple backtick fences → broken when copied
