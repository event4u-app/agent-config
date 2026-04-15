---
name: markdown-safe-codeblocks
description: "Use when generating markdown code blocks to avoid broken or non-copyable blocks, especially with nested backticks."
source: project
---

# markdown-safe-codeblocks

## When to use

* Generating markdown with code blocks
* Creating templates/files for copy/paste
* Writing docs with multiple code examples
* Embedding code inside markdown examples
* User complains about broken/uncopyable code blocks

Do not use when only inline code is involved.

## Goal

* Ensure all markdown is fully copyable
* Prevent broken rendering from nested backticks
* Stable formatting across ChatGPT, GitHub, VSCode

## Preconditions

* Markdown output required
* Code blocks may contain other code blocks
* Output must be copy-paste safe

## Decision hints

* Code contains triple backticks → DO NOT wrap in triple backticks again
* Nesting required → use alternative formatting
* Unsure → prefer plain text over markdown fences
* Stability over "pretty formatting"

## Procedure

### 1. Detect nested code blocks

Check if content contains triple backticks, markdown fences, or multi-language snippets.

### 2. Choose safe output format

A) Plain text blocks (preferred) → no backtick fences
B) Replace inner backticks → indentation or placeholders
C) Alternative fences → ~~~ instead of backtick fences

### 3. Generate safely

    Safe example:
    php artisan route:list --json

### 4. Validate

* No broken markdown rendering
* No prematurely closed blocks
* Entire content selectable & copyable

## Output format

1. Fully copyable content
2. No broken markdown
3. No nested triple backticks
4. Clean formatting over fancy formatting

## Core rules

* NEVER nest triple backticks inside triple backticks
* Prefer plain text over markdown if unsure
* Avoid mixing markdown + code fences in templates
* Robust across platforms — simpler is safer

## Gotchas

* ChatGPT often breaks markdown when nesting backtick fences
* GitHub may render differently than ChatGPT
* VSCode preview may hide errors users see when copying
* Syntax highlighting less important than correctness

## Do NOT

* Do NOT nest backtick fences inside backtick fences
* Do NOT generate partially closed code blocks
* Do NOT prioritize formatting over usability
* Do NOT assume the renderer will "fix it"

## Auto-trigger keywords

* markdown, code block, copy paste, broken formatting
* backticks, triple backticks, template generation

## Environment notes

Works in: ChatGPT UI, Claude, GitHub markdown, VSCode preview.
Always optimize for copy/paste reliability.
