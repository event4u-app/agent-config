---
name: readme-reviewer
description: "Use when reviewing a README for accuracy, usability, and alignment with the actual repository. Detects invented content, broken setup steps, and structural issues."
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# readme-reviewer

## When to use

- Reviewing a newly created or rewritten README
- Validating a README matches the actual repository
- Auditing README quality across repos
- Checking for hallucinated setup, commands, or features

Do NOT use for:

- Grammar or formatting proofreading only
- Writing a README from scratch → use `readme-writing` or `readme-writing-package`

## Goal

Ensure README is correct (no invented content), aligned with the repo,
useful for the audience, with a strong quickstart path.

## Core principles

- Evidence over assumption — verify every claim against the repo
- Commands must exist — check `Taskfile.yml`, `Makefile`, `package.json scripts`
- Examples must match real APIs — compare against source code
- Quickstart quality matters more than completeness
- A clean-looking README can still be technically wrong

## Procedure

### 1. Identify README type and audience

Determine repo type (package, app, CLI, internal, framework) and audience
(consumers, contributors, team). Check if structure matches type.

### 2. Cross-check against repository

Inspect truth-defining files:

- `package.json` / `composer.json` — name, scripts, dependencies
- `Dockerfile` / `docker-compose.yml` — runtime setup
- `Taskfile.yml` / `Makefile` — available commands
- CI workflows — what gets tested
- Source entrypoints — actual public API
- Config files, tests, existing docs

Verify: install steps exist, commands work, features implemented, dependencies real.

### 3. Validate installation and setup

Check:

- Install command correct and complete
- Required post-install steps documented
- No hidden setup assumptions
- Environment/config requirements listed

Flag: missing steps, incorrect steps, implied-but-unwritten steps.

### 4. Validate usage examples

Check:

- First example minimal and realistic
- Example matches actual API (verify against source)
- Example doesn't rely on undocumented setup
- Example not overly complex or abstract

Flag: pseudo-code, oversized examples, API mismatches.

### 5. Validate compatibility and requirements

Check:

- Runtime versions stated (PHP, Node, etc.)
- Framework compatibility explicit
- Dependencies declared

Flag: missing compatibility, vague claims ("works with most versions"),
unconfirmed broad support.

### 6. Evaluate structure and clarity

Check:

- Strong first screen (what + why + quickstart before scroll)
- Logical section order for repo type
- No unnecessary sections (padded boilerplate)
- No missing critical sections

Common issues: architecture before installation, no quickstart, buried
usage, generic template sections.

### 7. Detect hallucinations

Search for:

- Commands not in repo
- Features not implemented
- Setup steps not supported by scripts/configs
- Assumptions about environment or tools

Classify each finding:

- **Confirmed incorrect** — verifiably wrong
- **Likely incorrect** — no evidence found, needs verification
- **Unclear** — cannot confirm or deny, needs human input

### 8. Check scope, size, and splitting

- README not overloaded with deep technical detail
- Complex content belongs in `/docs`, not README
- Important onboarding info not missing due to over-compression

Size checks:

- **< 150 lines** — healthy
- **150–300 lines** — expect a Table of Contents; flag if missing
- **300–500 lines** — flag as overloaded; deep content should be in `/docs/`
- **> 500 lines** — flag as broken entry point; hard split required

Structure checks:

- ToC present if > 150 lines or > 6 top-level (`##`) sections
- Multi-platform install (> 5 variants) uses a table with deep links, not stacked blocks
- `<details>` used only for secondary, bulky content — never for install, first example, or requirements
- No duplication between README and `/docs/` (drifts over time)
- Each `/docs/` file linked from README is self-contained (not just a fragment)

→ See `guidelines/docs/readme-size-and-splitting.md` for full thresholds,
splitting strategies, anti-patterns.

## Output format

### 1. Summary

| Field | Value |
|---|---|
| Repo type | {type} |
| Audience | {audience} |
| Overall | {short assessment} |

### 2. Findings

| # | Severity | Section | Issue | Fix |
|---|---|---|---|---|
| 1 | ❌ Critical | Install | Command `X` does not exist | Replace with `Y` |
| 2 | ⚠️ Major | Usage | Example uses deprecated API | Update to current API |
| 3 | ℹ️ Minor | Structure | Requirements buried below usage | Move above install |

Severity levels:

- **❌ Critical** — breaks onboarding or factually incorrect
- **⚠️ Major** — confusing, incomplete, or misleading
- **ℹ️ Minor** — clarity, formatting, structure

### 3. Confidence

- What is confirmed correct
- What needs human verification
- What is unclear due to missing context

## Gotcha

- Model trusts the README instead of verifying against the repo
- Model may miss subtle mismatches between examples and real APIs
- Model focuses on wording/style instead of correctness
- Well-formatted README with wrong commands worse than ugly but correct
- Model accepts "looks reasonable" compatibility without checking CI matrix

## Do NOT

- Do NOT assume README is correct without checking the repo
- Do NOT ignore missing or broken setup steps
- Do NOT accept vague compatibility statements as valid
- Do NOT focus only on wording while missing structural/correctness issues
- Do NOT overlook mismatches between examples and actual source code
- Do NOT soften findings — state issues clearly with severity