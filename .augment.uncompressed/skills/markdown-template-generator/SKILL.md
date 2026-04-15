---
name: markdown-template-generator
description: "Use when generating reusable markdown templates (README, docs, configs) that must be copy-paste safe."
source: project
---

# markdown-template-generator

## When to use

Use this skill when:

* Creating reusable markdown templates
* Generating documentation structures
* Building SKILL.md, README.md, or config templates
* Output must be directly copyable

Do not use this skill when:

* Writing regular documentation content (not a template)
* Only inline code is involved

## Goal

* Generate clean, reusable markdown templates
* Ensure copy/paste works without breaking formatting
* Avoid markdown rendering issues

## Preconditions

* Output is markdown
* Template may include code or commands
* Must be stable across ChatGPT, GitHub, VSCode

## Decision hints

* If template contains code → avoid triple backticks nesting
* If unsure → use plain text instead of code fences
* Prefer readability over fancy formatting

## Procedure

1. Define structure (headings, sections)
2. Add placeholders ([value], {VAR}, etc.)
3. Insert examples WITHOUT unsafe code blocks
4. Keep formatting simple and robust
5. Validate copy/paste safety

## Output format

1. Full template
2. No broken markdown
3. Clean headings and sections

## Core rules

* Never nest triple backticks
* Prefer plain text for commands
* Use consistent section structure
* Keep templates minimal and reusable

## Gotchas

* Nested code blocks break copy/paste
* Markdown rendering differs across tools
* Over-formatting reduces usability

## Do NOT

* Do NOT use nested backtick fences
* Do NOT mix multiple markdown styles inconsistently
* Do NOT generate non-copyable templates

## Auto-trigger keywords

* template
* markdown template
* README template
* docs template
* generate template
