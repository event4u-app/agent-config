---
name: readme-writing
description: "Use when creating, rewriting, or significantly improving a README based on the actual repository structure, commands, and intended audience."
source: package
---

# readme-writing

## When to use

- Creating a new README for an **application, CLI tool, internal tool, template, or framework**
- Rewriting an outdated or weak README
- Improving after major repo changes (new tooling, restructure)

Do NOT use for:

- **Packages/libraries** → use `readme-writing-package` instead
- Minor typos, single-section updates, reference docs in separate files

## Goal

Accurate, evidence-based, scannable README for the intended audience.
Reflects the real repository — not assumptions.

## Core principles

- Analyze first, write second — inspect repo before writing
- Evidence-based — every command, step, feature must exist in repo
- Strong quickstart over exhaustive noise — get started in 30 seconds
- Right scope — overview in README, deep content in dedicated docs
- Match repo type — package README ≠ app ≠ CLI tool ≠ framework

## Procedure

### 1. Identify README type and audience

| Type | Audience | Priority |
|---|---|---|
| **Library/Package** | Developers consuming it | Install → Usage → API |
| **Application** | Team / contributors | Setup → Dev workflow → Architecture |
| **CLI tool** | End users | Install → Commands → Examples |
| **Template/Starter** | Bootstrappers | What you get → Quickstart → Customize |
| **Internal tool** | Team members | Purpose → Setup → Common tasks |
| **Agent/Framework** | AI tools + maintainers | What it is → Install → Architecture → Extend |

### 2. Inspect the repository

Read truth-defining files:

- `README.md` (existing), `package.json`, `composer.json`
- `Dockerfile`, `docker-compose.yml`
- `Taskfile.yml`, `Makefile`
- CI workflows, config files, `docs/`, `agents/`

Extract: purpose, install path, commands, requirements, workflows, testing, contribution flow.

### 3. Choose sections

Only include sections that provide value:

1. **Title + one-line summary** — always
2. **Why / what problem** — if not obvious from name
3. **Key features** — if more than trivial
4. **Requirements** — only if non-obvious
5. **Installation / setup** — always
6. **Usage / quickstart** — always (most important)
7. **Configuration** — if applicable
8. **Development workflow** — if accepts contributions
9. **Testing / quality** — if tooling exists
10. **Project structure** — if non-trivial
11. **Contributing** — if open/team project
12. **License** — if applicable

Skip empty or near-empty sections entirely.

### 4. Write evidence-based content

- Only document commands that exist in the repo
- Only describe setup steps supported by scripts/configs
- Only claim features confirmed by code or docs
- Unclear? Inspect more or ask — never invent

Formatting: tables for comparisons, code blocks for commands (copy-pasteable),
short paragraphs (max 3 sentences), directory trees for structure.

### 5. Optimize for first screen

Reader must answer within 10 seconds: What is this? Why? How to start?

First screen (before scroll): title, summary, install or quickstart.

### 6. Validate

- [ ] Every command exists in repo (`Taskfile.yml`, `Makefile`, `package.json`, etc.)
- [ ] Setup steps are reproducible
- [ ] No invented features or capabilities
- [ ] First screen answers: what, why, how-to-start
- [ ] No dead sections (heading with 1-2 trivial sentences)
- [ ] Deep content in dedicated docs, not crammed in README
- [ ] All file paths and references are valid

## Output format

1. Full README draft
2. Short note: detected repo type + audience
3. Uncertainties or assumptions needing confirmation

## Gotcha

- Model writes generic boilerplate instead of repo-specific docs
- Model includes commands/steps that don't exist in the repo
- Model over-documents, burying the quickstart under walls of text
- Existing README structure can mislead — don't preserve weak structure blindly
- Package READMEs need install/usage focus, not internal dev workflow
- Model forgets to validate commands against `Taskfile.yml` / `Makefile` / `package.json`

## Do NOT

- Do NOT invent features, setup steps, or commands not in the repo
- Do NOT copy generic templates without adapting to the project
- Do NOT overload with deep reference material — link to docs
- Do NOT write for "everyone" — choose a real audience
- Do NOT skip repository inspection before writing
- Do NOT preserve weak structure just because it exists
- Do NOT add marketing language ("blazing fast", "revolutionary")
