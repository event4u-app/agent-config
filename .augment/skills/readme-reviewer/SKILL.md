---
name: readme-reviewer
description: "Use when reviewing a README for accuracy, usability, and alignment with the actual repository. Detects invented content, broken setup steps, and structural issues."
source: package
---

# readme-reviewer

## When to use

- Reviewing a newly created or rewritten README
- Validating README matches actual repository
- Auditing README quality, checking for hallucinated content

Do NOT use for grammar-only proofreading or writing from scratch → use `readme-writing` / `readme-writing-package`.

## Goal

README is correct, repo-aligned, audience-appropriate, with strong quickstart.

## Core principles

- Evidence over assumption — verify every claim against repo
- Commands must exist — check `Taskfile.yml`, `Makefile`, `package.json`
- Examples must match real APIs — compare against source
- Clean-looking README can still be technically wrong

## Procedure

### 1. Identify type and audience

Determine repo type (package/app/CLI/internal/framework) and audience.
Check if structure matches type.

### 2. Cross-check against repo

Inspect: `package.json` / `composer.json`, `Dockerfile`, `Taskfile.yml` / `Makefile`,
CI workflows, source entrypoints, configs, tests, docs.

Verify: install steps exist, commands work, features are implemented, dependencies are real.

### 3. Validate installation

- Install command correct and complete
- Post-install steps documented
- No hidden setup assumptions
- Environment/config requirements listed

### 4. Validate examples

- First example minimal and realistic
- Matches actual API (verify against source)
- No undocumented setup dependencies
- Not overly complex or abstract

### 5. Validate compatibility

- Runtime versions stated
- Framework compatibility explicit
- No vague claims ("works with most versions")

### 6. Evaluate structure

- Strong first screen (what + why + quickstart before scroll)
- Logical section order for repo type
- No padded boilerplate, no missing critical sections

### 7. Detect hallucinations

Search for: commands not in repo, unimplemented features, unsupported setup steps.

Classify: **confirmed incorrect** | **likely incorrect** | **unclear**.

### 8. Check scope

README not overloaded with deep detail. Complex content → `/docs`.

## Output format

### 1. Summary

| Field | Value |
|---|---|
| Repo type | {type} |
| Audience | {audience} |
| Overall | {assessment} |

### 2. Findings

| # | Severity | Section | Issue | Fix |
|---|---|---|---|---|
| 1 | ❌ Critical | Install | Command `X` does not exist | Replace with `Y` |
| 2 | ⚠️ Major | Usage | Example uses deprecated API | Update to current |
| 3 | ℹ️ Minor | Structure | Requirements buried below usage | Move above install |

Severity: ❌ Critical (breaks onboarding / incorrect), ⚠️ Major (confusing / incomplete), ℹ️ Minor (clarity).

### 3. Confidence

What is confirmed, what needs verification, what is unclear.

## Gotcha

- Model trusts README instead of verifying against repo
- Model misses subtle mismatches between examples and real APIs
- Model focuses on wording/style instead of correctness
- Well-formatted README with wrong commands is worse than ugly but correct
- Model accepts "looks reasonable" compatibility without checking CI matrix

## Do NOT

- Do NOT assume README correct without repo check
- Do NOT ignore missing or broken setup steps
- Do NOT accept vague compatibility as valid
- Do NOT focus on wording while missing correctness issues
- Do NOT overlook example/source mismatches
- Do NOT soften findings — state issues clearly with severity
