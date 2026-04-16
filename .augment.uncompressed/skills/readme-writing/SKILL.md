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
- Adapting README for a different audience

Do NOT use when:

- Writing a README for a **reusable package or library** → use `readme-writing-package` instead
- Fixing minor typos or updating a single section
- Writing reference docs that belong in separate files
- Only adding a badge or version bump

## Goal

Write a README that is accurate, evidence-based, scannable, and useful for
the intended audience. Reflects the real repository — not assumptions.

## Core principles

- **Analyze first, write second** — inspect the repo before writing a single line
- **Evidence-based only** — every command, setup step, and feature must exist in the repo
- **Strong quickstart over exhaustive noise** — a reader should get started in 30 seconds
- **Right scope** — high-level overview in README, deep content in dedicated docs
- **Match the repo type** — a package README differs from an app, CLI tool, or framework

## Procedure

### 1. Identify README type and audience

Determine repository type:

| Type | Audience | Priority |
|---|---|---|
| **Library/Package** | Developers consuming it | Install → Usage → API |
| **Application** | Team / contributors | Setup → Dev workflow → Architecture |
| **CLI tool** | End users | Install → Commands → Examples |
| **Template/Starter** | Bootstrappers | What you get → Quickstart → Customize |
| **Internal tool** | Team members | Purpose → Setup → Common tasks |
| **Agent/Framework** | AI tools + maintainers | What it is → Install → Architecture → Extend |

### 2. Inspect the repository

Read these files to extract truth:

- `README.md` (existing, if any)
- `package.json`, `composer.json` — name, description, scripts, dependencies
- `Dockerfile`, `docker-compose.yml` — runtime setup
- `Taskfile.yml`, `Makefile` — available commands
- CI workflows — what gets tested, how
- `docs/`, `agents/` — existing documentation
- Config files — what tools are used

Extract: project purpose, install path, main commands, requirements,
key workflows, testing/linting commands, contribution flow.

### 3. Choose sections

Only include sections that provide value. Candidates:

1. **Title + one-line summary** — always
2. **Why / what problem it solves** — if not obvious from name
3. **Key features or capabilities** — if more than a trivial tool
4. **Requirements** — only if non-obvious
5. **Installation / setup** — always
6. **Usage / quickstart** — always (most important section)
7. **Configuration / customization** — if applicable
8. **Development workflow** — if repo accepts contributions
9. **Testing / quality** — if tooling exists
10. **Project structure** — if non-trivial
11. **Contributing** — if open or team project
12. **License** — if applicable

Do NOT include sections "because READMEs usually have them."
Skip empty or near-empty sections entirely.

### 4. Write evidence-based content

Rules:

- Only document commands that actually exist in the repo
- Only describe setup steps supported by scripts/configs
- Only claim features confirmed by code or docs
- If something is unclear: inspect more or ask — never invent

Formatting:

- Tables for structured comparisons (tools, options, features)
- Code blocks for every command (copy-pasteable)
- Short paragraphs — max 3 sentences before a break
- Directory trees for project structure (use `tree` format)
- Badges only if they link to live CI/release status

### 5. Optimize for the first screen

A reader scanning the README should answer within 10 seconds:

1. What is this?
2. Why does it exist?
3. How do I install/start it?

The first screen (before scrolling) must contain the title, summary,
and either install command or quickstart. Everything else comes after.

### 6. Validate

After writing, verify:

- [ ] Every documented command exists in the repo (`Taskfile.yml`, `Makefile`, `package.json scripts`, etc.)
- [ ] Setup steps are reproducible (no missing prerequisites)
- [ ] No features or capabilities are invented
- [ ] First screen answers: what, why, how-to-start
- [ ] No dead sections (heading with 1-2 trivial sentences)
- [ ] Scope is right — deep content moved to dedicated docs, not crammed in
- [ ] Matches existing tonality if repo has established voice
- [ ] All file paths and references are valid

## Output format

1. Full README draft
2. Short note: detected repo type + audience
3. Any uncertainties or assumptions that need confirmation

## Gotcha

- The model tends to write generic boilerplate instead of repo-specific documentation
- The model tends to include commands or setup steps that don't actually exist in the repo
- The model tends to over-document and bury the quickstart under walls of text
- Existing README structure can be misleading — don't preserve weak structure blindly
- READMEs for packages consumed by others need install/usage focus, not internal dev workflow
- The model forgets to validate commands against `Taskfile.yml` / `Makefile` / `package.json scripts`

## Do NOT

- Do NOT invent features, setup steps, or commands not found in the repo
- Do NOT copy generic README templates without adapting to the actual project
- Do NOT overload with deep reference material — link to docs instead
- Do NOT write for "everyone" — choose a real audience
- Do NOT skip repository inspection before writing
- Do NOT preserve weak structure from an existing README just because it exists
- Do NOT add marketing language ("blazing fast", "revolutionary", "next-gen")
