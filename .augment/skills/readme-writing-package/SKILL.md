---
name: readme-writing-package
description: "Use when creating or rewriting a README for a reusable package or library. Focus on installability, minimal usage example, compatibility, and developer onboarding."
source: package
---

# readme-writing-package

## When to use

- Creating a README for a package, library, SDK, or framework extension
- Rewriting a package README after major changes
- Improving a weak package README (missing install, no example, no compatibility)

Do NOT use for apps, CLI tools, or internal team repos → use `readme-writing` instead.

## Goal

Developer knows within 30 seconds: what it does, fits their stack, how to install, how to use.

## Core principles

- User adoption over internal architecture
- Install + first example = most important sections
- Compatibility must be explicit — no implied broad support
- First code example: real, minimal, verified — no pseudo-code
- README = onboarding, /docs = reference

## Procedure

### 1. Identify package type and audience

| Type | Audience | README focus |
|---|---|---|
| **Library** | Any developer | Install → Usage → API surface |
| **Framework extension** | Framework users | Requirements → Install → Register → Use |
| **Plugin** | Plugin host users | Compatibility → Install → Config → Use |
| **SDK** | API consumers | Auth → Install → First request → Response |
| **Internal package** | Team members | Purpose → Install → Integration → Dev workflow |

### 2. Inspect package truth sources

Read: `composer.json` / `package.json`, source entrypoints, config files,
CI workflows (version matrix), tests, CHANGELOG, examples directory.

Extract: name, purpose, install command, requirements, supported versions,
public API, setup steps, test/lint commands.

### 3. Choose sections (priority order)

1. **Title + summary** — always
2. **Why / problem** — if not obvious
3. **Requirements / compatibility** — always
4. **Installation** — always
5. **Minimal usage example** — always (most important)
6. **Configuration** — if needed
7. **More examples** — if multiple entry points
8. **Development / testing** — for contributors
9. **Contributing** — if open/team
10. **License** — if applicable

### 4. Write requirements and compatibility

```
## Requirements

- PHP ^8.2
- Laravel 11.x
- ext-json
```

Only state what is tested and supported.

### 5. Write installation

```bash
composer require vendor/package

# If framework integration needed:
php artisan vendor:publish --tag=package-config
```

Validate each step against codebase. Include post-install steps.

### 6. Write minimal working example

**Most critical section.** Rules:

- Smallest working example — one use case, one result
- Real API, not pseudo-code — copy-pasteable
- 5-15 lines, immediately runnable
- Verify against actual source code

### 7. Keep architecture out of README

Deep content → `/docs/`. README = enough to adopt, docs = enough to master.

### 8. Validate

- [ ] Install command correct and complete
- [ ] Compatibility matches `composer.json` / `package.json` / CI matrix
- [ ] First example matches real API (verified against source)
- [ ] All documented commands exist
- [ ] No invented features
- [ ] First screen shows: what, install, requirements

## Output format

1. README draft
2. Package type + audience
3. Compatibility summary
4. Uncertainties needing confirmation

## Gotcha

- Model writes package READMEs like app READMEs (too much architecture)
- Model invents compatibility claims or setup steps
- First example too large, abstract, or pseudo-code
- Model over-explains internals before showing usage
- Existing README may be outdated — verify against source, not old text
- Model forgets post-install steps (config publish, service provider, env vars)

## Do NOT

- Do NOT invent package capabilities or compatibility
- Do NOT skip the minimal working example
- Do NOT prioritize architecture over user onboarding
- Do NOT document commands not in the repo
- Do NOT hide requirements or version constraints
- Do NOT write giant examples when 10 lines suffice
- Do NOT overload README with reference material — link to /docs
