---
name: markdown-safe-codeblocks
description: "Use when generating markdown code blocks to avoid broken or non-copyable blocks, especially with nested backticks."
source: project
---

# markdown-safe-codeblocks

## When to use

Use this skill when:

* Generating markdown with code blocks
* Creating templates or files for copy/paste
* Writing documentation with multiple code examples
* Embedding code inside markdown examples
* The user complains about broken or uncopyable code blocks

Typical examples:

* SKILL.md templates
* README.md files
* config/code snippets
* multi-language examples

Do not use this skill when:

* No code blocks are involved
* Only inline code is used

## Goal

The goal of this skill is to:

* Ensure all markdown is fully copyable
* Prevent broken rendering due to nested backticks
* Keep formatting stable across ChatGPT, GitHub, VSCode

## Preconditions

* Markdown output is required
* Code blocks may contain other code blocks or markdown
* The output must be copy-paste safe

## Decision hints

* If code contains triple backticks → DO NOT wrap it in triple backticks again
* If nesting is required → use alternative formatting
* If unsure → prefer plain text blocks over markdown fences
* Prefer stability over "pretty formatting"

## Procedure

### 1. Detect nested code blocks

Check if the content already contains:

* triple backticks
* markdown fences
* multi-language snippets

### 2. Choose safe output format

Use ONE of these strategies:

A) Use plain text blocks (preferred)
→ no backtick fences at all

B) Replace inner backticks
→ use indentation or placeholders

C) Use alternative fences
→ ~~~ instead of backtick fences

### 3. Generate output safely

Safe example (preferred):

    Code example:
    php artisan route:list --json

### 4. Validate output

Check:

* No broken markdown rendering
* No prematurely closed blocks
* Entire content is selectable & copyable

## Output format

1. Fully copyable content
2. No broken markdown
3. No nested triple backticks
4. Clean formatting over fancy formatting

## Core rules

* NEVER nest triple backticks inside triple backticks
* Prefer plain text over markdown if unsure
* Avoid mixing markdown + code fences in templates
* Keep output robust across platforms
* Simpler is safer

## Gotchas

* ChatGPT often breaks markdown when nesting backtick fences
* GitHub may render differently than ChatGPT
* VSCode preview may hide errors that users see when copying
* Syntax highlighting is less important than correctness

## Do NOT

* Do NOT nest backtick fences inside backtick fences
* Do NOT generate partially closed code blocks
* Do NOT prioritize formatting over usability
* Do NOT assume the renderer will "fix it"

## Auto-trigger keywords

* markdown
* code block
* copy paste
* broken formatting
* backticks
* triple backticks
* template generation

## Examples

Example request:
"Create a markdown template with code examples"

Bad output:
* nested backtick fences → broken rendering

Good output:
* plain text or safe formatting → fully copyable

## Environment notes

Works in:

* ChatGPT UI
* Claude
* GitHub markdown
* VSCode preview

Always optimize for:
→ copy/paste reliability
