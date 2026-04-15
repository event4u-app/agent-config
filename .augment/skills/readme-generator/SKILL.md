---
name: readme-generator
description: "Use when creating or improving README.md files for projects, ensuring clarity, structure, and usability."
source: project
---

# readme-generator

## When to use

* Creating a new README.md
* Improving an existing README
* Documenting setup, usage, or architecture

Do not use for module-specific agent docs (use agent-docs) or markdown templates (use markdown-template-generator).

## Goal

* Clear, structured, developer-friendly README files
* Fast onboarding with copyable commands

## Preconditions

* Project context known (tech stack, purpose)
* Commands must be executable
* Output must be copy-paste safe

## Decision hints

* Backend → setup + API usage
* Frontend → dev + build steps
* Fullstack → separate backend/frontend sections

## Procedure

1. Project title + short description
2. Installation/setup steps
3. Usage examples
4. Configuration notes
5. Troubleshooting or FAQ

## Output format

1. Title + description → Setup → Usage → Optional sections (config, troubleshooting)

## Core rules

* Concise but complete
* Clear headings
* Commands must work as-is
* Copyable instructions

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
