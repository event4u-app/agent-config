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
- Rewriting a package README after major changes (new API, version bump, new registry)
- Improving a weak package README (missing install, no example, no compatibility info)
- Documenting a package for Packagist, npm, or internal registries

Do NOT use when:

- Documenting a full application, CLI tool, or internal team repo → use `readme-writing` instead
- Only fixing minor typos or updating a single section
- Writing deep reference docs that belong in `/docs`

## Goal

Package README that makes adoption easy. A developer should know within 30 seconds:
what it does, whether it fits their stack, how to install it, and how to use it.

## Core principles

- **User adoption over internal architecture** — consumer first, maintainer second
- **Install + first example = most important sections** — everything else is secondary
- **Compatibility must be explicit** — don't imply broad support without evidence
- **First code example must be real, minimal, and verified** — no pseudo-code
- **README = onboarding, /docs = reference** — keep README focused

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

Read files that define actual package behavior:

- `composer.json` / `package.json` — name, description, requirements, scripts
- Source entrypoints — public API surface, main classes/functions
- Config files — publishable configs, defaults
- CI workflows — what gets tested, supported versions matrix
- Tests — reveal actual API usage patterns
- `CHANGELOG.md` / releases — current state, breaking changes
- Examples directory — if present

Extract: package name, purpose, install command, runtime requirements,
supported versions, public API, setup steps, test/lint commands.

### 3. Choose sections

Priority order for packages:

1. **Title + one-line summary** — always
2. **Why / what problem** — if not obvious from name
3. **Requirements / compatibility** — always (versions, extensions, frameworks)
4. **Installation** — always (exact command, post-install steps)
5. **Minimal usage example** — always (most important section)
6. **Configuration / setup** — if config publish, env vars, or registration needed
7. **More examples / common use cases** — if API has multiple entry points
8. **Development / testing** — for maintainers/contributors
9. **Contributing** — if open or team project
10. **License** — if applicable

Skip sections that have no real content. Never pad.

### 4. Write requirements and compatibility

State only what is tested and supported:

```
## Requirements

- PHP ^8.2
- Laravel 11.x
- ext-json
```

Do NOT imply broad compatibility if only tested in narrow range.
Include framework version, language version, required extensions, services.

### 5. Write installation that actually works

Document the exact install command and any required follow-up:

```bash
composer require vendor/package

# If framework integration needed:
php artisan vendor:publish --tag=package-config
```

Validate each step against the actual codebase.
Include post-install steps (publish, register, env setup) if required.

### 6. Write the minimal working example

**This is the most critical section.** Rules:

- Smallest possible working example — one use case, one result
- Real API calls, not pseudo-code
- Copy-pasteable without hidden setup
- Show expected result or effect if helpful
- Must match the actual package API (verify against source)

Bad: abstract, large, requires unexplained setup.
Good: 5-15 lines, directly relevant, immediately runnable.

### 7. Keep architecture out of README — use reference-split

Move deep content to dedicated docs. Recommended layout for packages:

```
README.md              ← entry: what, why, install, minimal usage
docs/
  installation.md      ← full install matrix, post-install steps
  usage.md             ← extended examples, common patterns
  architecture.md      ← internal design, decisions
  api.md               ← full API reference
  migration.md         ← version upgrade guides
```

For multi-platform install (> 5 variants), prefer a single table with
deep links over stacked inline blocks. For occasionally-needed detail
(long platform quirks, troubleshooting), use `<details>` — never for
install, first example, or requirements.

→ See `docs/guidelines/docs/readme-size-and-splitting.md` for thresholds,
deep-link-table pattern, collapsibles, and anti-patterns (premature
splitting, duplication between README and `/docs/`).

README = enough to adopt. Docs = enough to master.

### 8. Validate

- [ ] Install command is correct and complete
- [ ] Compatibility/requirements match `composer.json` / `package.json` / CI matrix
- [ ] First example matches real API (verified against source code)
- [ ] All documented commands exist in repo
- [ ] No invented features or capabilities
- [ ] Consumer can get started without reading source code
- [ ] Deep content is in docs, not README (see size guideline)
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

- Model writes package READMEs like app READMEs (too much architecture, not enough install/usage)
- Model tends to invent compatibility claims or setup steps
- First example is often too large, too abstract, or uses pseudo-code
- Model over-explains internals before showing how to use the package
- Existing README may be outdated — verify against actual `composer.json` / source, not old text
- Model forgets post-install steps (config publish, service provider, env vars)

## Do NOT

- Do NOT invent package capabilities or compatibility
- Do NOT skip the minimal working example
- Do NOT prioritize internal architecture over user onboarding
- Do NOT document commands not present in the repo
- Do NOT hide requirements or version constraints
- Do NOT write a giant example when a 10-line one would do
- Do NOT overload README with reference material — link to /docs
