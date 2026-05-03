---
name: readme-writing-package
description: "Use when creating or rewriting a README for a reusable package or library. Focus on installability, minimal usage example, compatibility, and developer onboarding."
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# readme-writing-package

## When to use

- Creating a README for a package, library, SDK, or framework extension
- Rewriting after major changes (new API, version bump, new registry)
- Improving a weak package README (missing install, no example, no compatibility)
- Documenting for Packagist, npm, or internal registries

Do NOT use for:

- Full applications, CLI tools, internal team repos → use `readme-writing`
- Minor typos, single-section updates, deep reference docs in `/docs`

## Goal

Package README that makes adoption easy. Developer knows within 30 seconds:
what it does, whether it fits their stack, how to install, how to use.

## Core principles

- User adoption over internal architecture — consumer first, maintainer second
- Install + first example = most important sections
- Compatibility must be explicit — don't imply broad support without evidence
- First example: real, minimal, verified — no pseudo-code
- README = onboarding, /docs = reference

## Procedure

### 1. Identify package type and audience

| Type | Audience | README focus |
|---|---|---|
| **Library** | Any developer | Install → Usage → API surface |
| **Framework extension** | Framework users | Requirements → Install → Register → Use |
| **Plugin** | Plugin host users | Compatibility → Install → Config → Use |
| **SDK** | API consumers | Auth → Install → First request → Response handling |
| **Internal shared package** | Team members | Purpose → Install → Integration → Dev workflow |

### 2. Inspect package truth sources

- `composer.json` / `package.json` — name, description, requirements, scripts
- Source entrypoints — public API, main classes/functions
- Config files — publishable configs, defaults
- CI workflows — supported versions matrix
- Tests — actual API usage patterns
- `CHANGELOG.md` / releases — current state, breaking changes
- Examples directory if present

Extract: name, purpose, install command, runtime requirements, supported
versions, public API, setup steps, test/lint commands.

### 3. Choose sections

Priority order for packages:

1. **Title + one-line summary** — always
2. **Why / what problem** — if not obvious from name
3. **Requirements / compatibility** — always (versions, extensions, frameworks)
4. **Installation** — always (exact command, post-install steps)
5. **Minimal usage example** — always (most important)
6. **Configuration** — if config publish, env vars, or registration needed
7. **More examples** — if API has multiple entry points
8. **Development / testing** — for maintainers/contributors
9. **Contributing** — if open/team project
10. **License** — if applicable

Skip sections with no real content. Never pad.

### 4. Write requirements and compatibility

State only what is tested and supported:

```
## Requirements

- PHP ^8.2
- Laravel 11.x
- ext-json
```

Don't imply broad compatibility if only tested in narrow range. Include
framework version, language version, required extensions, services.

### 5. Write installation that actually works

Exact install command and required follow-up:

```bash
composer require vendor/package

# If framework integration needed:
php artisan vendor:publish --tag=package-config
```

Validate each step against the codebase. Include post-install steps
(publish, register, env setup) if required.

### 6. Write minimal working example

**Most critical section.** Rules:

- Smallest possible working example — one use case, one result
- Real API calls, not pseudo-code
- Copy-pasteable without hidden setup
- Show expected result or effect if helpful
- Must match actual package API (verify against source)

Bad: abstract, large, requires unexplained setup.
Good: 5-15 lines, directly relevant, immediately runnable.

### 7. Keep architecture out of README — use reference-split

Move deep content to dedicated docs. Recommended layout:

```
README.md              ← entry: what, why, install, minimal usage
docs/
  installation.md      ← full install matrix, post-install steps
  usage.md             ← extended examples, common patterns
  architecture.md      ← internal design, decisions
  api.md               ← full API reference
  migration.md         ← version upgrade guides
```

Multi-platform install (> 5 variants): prefer single table with deep
links over stacked inline blocks. Occasionally-needed detail (long
platform quirks, troubleshooting): use `<details>` — never for install,
first example, or requirements.

→ See `docs/guidelines/docs/readme-size-and-splitting.md` for thresholds,
deep-link-table pattern, collapsibles, anti-patterns (premature
splitting, duplication between README and `/docs/`).

README = enough to adopt. Docs = enough to master.

### 8. Validate

- [ ] Install command is correct and complete
- [ ] Compatibility/requirements match `composer.json` / `package.json` / CI matrix
- [ ] First example matches real API (verified against source)
- [ ] All documented commands exist in repo
- [ ] No invented features or capabilities
- [ ] Consumer can get started without reading source code
- [ ] Deep content in docs, not README (see size guideline)
- [ ] Multi-platform install uses a table, not stacked blocks
- [ ] No duplication between README and `/docs/`
- [ ] First screen shows: what, install, requirements

## Output format

1. Full README draft
2. Detected package type + audience
3. Compatibility summary
4. Uncertainties needing confirmation
5. Suggested follow-up docs if README would become too large

## Gotcha

- Model writes package READMEs like app READMEs (too much architecture)
- Model invents compatibility claims or setup steps
- First example often too large, too abstract, or uses pseudo-code
- Model over-explains internals before showing how to use the package
- Existing README may be outdated — verify against `composer.json` / source
- Model forgets post-install steps (config publish, service provider, env vars)

## Do NOT

- Do NOT invent package capabilities or compatibility
- Do NOT skip the minimal working example
- Do NOT prioritize internal architecture over user onboarding
- Do NOT document commands not in the repo
- Do NOT hide requirements or version constraints
- Do NOT write a giant example when 10 lines would do
- Do NOT overload README with reference material — link to /docs