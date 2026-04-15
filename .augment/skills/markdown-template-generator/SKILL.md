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

Do not use when writing regular documentation (not a template) or only inline code.

## Goal

* Generate clean, reusable markdown templates
* Ensure copy/paste works without breaking formatting
* Avoid markdown rendering issues

## Preconditions

* Output is markdown
* Template may include code or commands
* Must be stable across ChatGPT, GitHub, VSCode

## Decision hints

* Template contains code → avoid triple backticks nesting
* Unsure → plain text instead of code fences
* Readability over fancy formatting

## Procedure

1. Define structure (headings, sections)
2. Add placeholders ([value], {VAR}, etc.)
3. Insert examples WITHOUT unsafe code blocks
4. Keep formatting simple and robust
5. Validate copy/paste safety

## Output format

1. Full template — no broken markdown — clean headings/sections

## Core rules

* Never nest triple backticks
* Prefer plain text for commands
* Consistent section structure
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

* template, markdown template, README template, docs template, generate template
