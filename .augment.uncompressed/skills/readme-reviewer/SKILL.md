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

Do NOT use when:

- Only proofreading grammar or formatting
- Writing a README from scratch → use `readme-writing` or `readme-writing-package`

## Goal

Ensure the README is correct (no invented content), aligned with the repo,
useful for the intended audience, and has a strong quickstart path.

## Core principles

- Evidence over assumption — verify every claim against the repo
- Commands must exist — check `Taskfile.yml`, `Makefile`, `package.json scripts`
- Examples must match real APIs — compare against source code
- Quickstart quality matters more than completeness
- A clean-looking README can still be technically wrong

## Procedure

### 1. Identify README type and audience

Determine repo type (package, app, CLI, internal, framework) and target audience
(consumers, contributors, team). Check if README structure matches this type.

### 2. Cross-check against repository

Inspect truth-defining files:

- `package.json` / `composer.json` — name, scripts, dependencies
- `Dockerfile` / `docker-compose.yml` — runtime setup
- `Taskfile.yml` / `Makefile` — available commands
- CI workflows — what gets tested
- Source entrypoints — actual public API
- Config files, tests, existing docs

Verify: install steps exist, commands work, features are implemented,
dependencies are real.

### 3. Validate installation and setup

Check:

- Install command is correct and complete
- Required post-install steps are documented
- No hidden setup assumptions
- Environment/config requirements are listed

Flag: missing steps, incorrect steps, implied-but-unwritten steps.

### 4. Validate usage examples

Check:

- First example is minimal and realistic
- Example matches actual API (verify against source)
- Example does not rely on undocumented setup
- Example is not overly complex or abstract

Flag: pseudo-code, oversized examples, API mismatches.

### 5. Validate compatibility and requirements

Check:

- Runtime versions stated (PHP, Node, etc.)
- Framework compatibility is explicit
- Dependencies are declared

Flag: missing compatibility, vague claims ("works with most versions"),
unconfirmed broad support.

### 6. Evaluate structure and clarity

Check:

- Strong first screen (what + why + quickstart visible before scrolling)
- Logical section order for repo type
- No unnecessary sections (padded boilerplate)
- No missing critical sections

Common issues: architecture before installation, no quickstart,
buried usage instructions, generic template sections.

### 7. Detect hallucinations

Explicitly search for:

- Commands not present in repo
- Features not implemented
- Setup steps not supported by scripts/configs
- Assumptions about environment or tools

Classify each finding:

- **Confirmed incorrect** — verifiably wrong
- **Likely incorrect** — no evidence found, needs verification
- **Unclear** — cannot confirm or deny, needs human input

### 8. Check scope

- README not overloaded with deep technical detail
- Complex content belongs in `/docs`, not README
- Important onboarding info not missing due to over-compression

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

- **❌ Critical** — breaks onboarding or is factually incorrect
- **⚠️ Major** — confusing, incomplete, or misleading
- **ℹ️ Minor** — clarity improvement, formatting, structure

### 3. Confidence

- What is confirmed correct
- What needs human verification
- What is unclear due to missing context

## Gotcha

- Model tends to trust the README instead of verifying against the repo
- Model may miss subtle mismatches between examples and real APIs
- Model may focus on wording/style instead of correctness
- A well-formatted README with wrong commands is worse than ugly but correct
- Model may accept "looks reasonable" compatibility without checking CI matrix

## Do NOT

- Do NOT assume README is correct without checking the repo
- Do NOT ignore missing or broken setup steps
- Do NOT accept vague compatibility statements as valid
- Do NOT focus only on wording while missing structural/correctness issues
- Do NOT overlook mismatches between examples and actual source code
- Do NOT soften findings — state issues clearly with severity
