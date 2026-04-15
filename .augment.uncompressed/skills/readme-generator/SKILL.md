---
name: readme-generator
description: "Use when creating or improving README.md files for projects, ensuring clarity, structure, and usability."
source: project
---

# readme-generator

## When to use

Use this skill when:

* Creating a new README.md
* Improving an existing README
* Documenting setup, usage, or architecture

Do not use this skill when:

* Writing module-specific agent docs (use agent-docs skill)
* Creating markdown templates (use markdown-template-generator)

## Goal

* Create clear, structured, developer-friendly README files
* Make onboarding fast and easy
* Provide copyable commands

## Preconditions

* Project context is known (tech stack, purpose)
* Commands should be executable
* Output must be copy-paste safe

## Decision hints

* If project is backend → include setup + API usage
* If frontend → include dev + build steps
* If fullstack → separate backend/frontend sections

## Procedure

1. Add project title + short description
2. Add installation/setup steps
3. Add usage examples
4. Add configuration notes
5. Add troubleshooting or FAQ

## Output format

1. Title + description
2. Setup steps
3. Usage
4. Optional sections (config, troubleshooting)

## Core rules

* Keep README concise but complete
* Use clear headings
* Commands must work as-is
* Prefer copyable instructions

## Gotchas

* Missing setup steps break onboarding
* Outdated commands confuse users
* Overly long READMEs reduce readability

## Do NOT

* Do NOT include broken commands
* Do NOT assume prior knowledge
* Do NOT use unsafe markdown blocks

## Auto-trigger keywords

* README
* project documentation
* setup guide
* installation guide
* onboarding
