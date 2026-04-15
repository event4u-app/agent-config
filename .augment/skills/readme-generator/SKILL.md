---
name: readme-generator
description: "Use when creating or improving README.md files for projects, ensuring clarity, structure, and usability."
source: project
---

# readme-generator

## When to use

* Creating new README.md
* Improving existing README
* Documenting setup, usage, or architecture

Do not use for module-specific agent docs (use agent-docs) or markdown templates (use markdown-template-generator).

## Goal

* Clear, structured, developer-friendly README
* Fast onboarding with copyable commands

## Preconditions

* Project context known (tech stack, purpose)
* Commands must be executable and copy-paste safe

## Decision hints

* Backend → setup + API usage
* Frontend → dev + build steps
* Fullstack → separate backend/frontend sections

## Procedure

### 0. Inspect

* README exists? Tech stack? Target audience?

### 1. Structure

1. Project title + short description
2. Installation/setup steps
3. Usage examples
4. Configuration notes
5. Troubleshooting or FAQ

### 2. Validate

* All commands executable as-is
* No missing prerequisites
* Self-contained for new developer

## Output format

1. Title + description → Setup → Usage → Optional (config, troubleshooting)
2. All commands copyable

## Core rules

* Concise but complete
* Clear headings
* Commands work as-is

## Gotchas

* Missing setup steps break onboarding
* Outdated commands confuse users
* Overly long READMEs reduce readability

## Do NOT

* Do NOT include broken commands
* Do NOT assume prior knowledge
* Do NOT use unsafe markdown blocks

## Auto-trigger keywords

* README, project documentation, setup guide, installation guide, onboarding

## Anti-patterns

* Wall of text without headings
* Commands requiring unstated prerequisites
* README without tech stack mention

## Examples

Good: Title → Tech stack → Setup (docker, env, migrate) → Usage → Config
Bad: Title → wall of text without headings or commands
