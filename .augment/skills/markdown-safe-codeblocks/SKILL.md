---
name: markdown-safe-codeblocks
description: "Use when generating markdown code blocks to avoid broken or non-copyable blocks, especially with nested backticks."
source: project
---

# markdown-safe-codeblocks

## When to use

* Generating markdown with code blocks
* Creating templates/files for copy/paste
* Docs with multiple code examples
* Embedding code inside markdown examples
* User reports broken/uncopyable blocks

Do not use when only inline code involved.

## Goal

* All markdown fully copyable
* No broken rendering from nested backticks
* Stable across ChatGPT, GitHub, VSCode

## Preconditions

* Markdown output required
* Code blocks may contain other code blocks
* Output must be copy-paste safe

## Decision hints

* Content contains triple backticks → DO NOT wrap in triple backticks again
* Nesting required → alternative formatting
* Unsure → plain text over markdown fences
* Stability over "pretty formatting"

## Procedure

### 0. Inspect content

* Contains triple backticks or markdown fences?
* Will output be nested inside another markdown file?

### 1. Choose safe output format

A) Plain text blocks (preferred) → no backtick fences
B) Replace inner backticks → indentation or placeholders
C) Alternative fences → ~~~ instead of backtick fences

### 2. Generate safely

    Safe example:
    php artisan route:list --json

### 3. Validate

* No nested triple backticks
* No prematurely closed blocks
* Entire content selectable & copyable in plain markdown view

## Output format

1. Fully copyable content only
2. No explanations unless requested
3. Clean formatting over fancy

## Core rules

* NEVER nest triple backticks inside triple backticks
* Plain text over markdown if unsure
* Avoid mixing markdown + code fences in templates
* Simpler is safer

## Gotchas

* ChatGPT often breaks markdown when nesting backtick fences
* GitHub renders differently than ChatGPT
* VSCode preview hides errors users see when copying
* Syntax highlighting less important than correctness

## Do NOT

* Do NOT nest backtick fences inside backtick fences
* Do NOT generate partially closed code blocks
* Do NOT prioritize formatting over usability
* Do NOT assume renderer will "fix it"

## Auto-trigger keywords

* markdown, code block, copy paste, broken formatting
* backticks, triple backticks, template generation

## Anti-patterns

* Wrapping markdown examples in triple backtick fences
* Relying on renderer to handle nested fences
* Syntax highlighting over correctness

## Examples

Safe:

    Command:
    php artisan route:list --json

Unsafe: nested triple backticks inside markdown blocks → broken, not copyable

## Environment notes

Works in: ChatGPT UI, Claude, GitHub markdown, VSCode preview.
Optimize for copy/paste reliability.
