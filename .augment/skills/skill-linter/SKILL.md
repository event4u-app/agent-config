---
name: skill-linter
description: "Use when validating skills or rules for structure, quality, duplication risk, and compression safety before merge or release."
source: project
---

# skill-linter

## When to use

* Reviewing new or changed SKILL.md
* Reviewing new or changed rule
* Checking compressed skill safety
* Quality checks before merge
* Preparing upstream contribution

Do not use when content is incomplete, creating from scratch without draft, or only wanting stylistic feedback.

## Goal

* Detect weak, incomplete, or misleading skills/rules
* Enforce structural standards
* Prevent duplication and over-broad guidance
* Ensure compression preserves critical behavior

## Preconditions

* Draft or changed skill/rule exists
* Source-of-truth file available
* Compressed file available if applicable

## Decision hints

* Missing Procedure or Output format → fail
* Vague validation → fail
* Broad enough for multiple workflows → warn/fail
* Compression removes validation/trigger → fail
* Existing guidance covers topic → warn duplication

## Procedure

### 0. Identify artifact type

Skill / rule / compressed / uncompressed

### 1. Validate structure

**Skills:** When to use (+ Do not use), Procedure (Step 0 + validation), Output format, Gotchas, Do NOT
**Rules:** Short, directive, always-applicable, not procedural

### 2. Validate trigger

* Description trigger-oriented ("Use when..."), under 200 chars
* "When to use" specific, scope narrow

### 3. Validate procedure

* Steps numbered, executable, not vague
* Final validation concrete
* Step 0 (Inspect) present

### 4. Validate output

* Defined, controls verbosity, matches purpose

### 5. Validate anti-failure

* Gotchas: real failure patterns
* Do NOT: enforceable constraints
* Anti-patterns if recurring

### 6. Validate duplication/scope

* No similar skill exists
* Single workflow per file
* Update existing preferred

### 7. Validate compression safety

Compressed preserves: trigger, decisions, validation, gotchas

### 8. Produce verdict

Pass / pass with warnings / fail

## Output format

1. Verdict (pass / warn / fail)
2. Issues by severity
3. Suggested fixes
4. Optional: sections to rewrite, split/merge/deprecate recommendation

## Core rules

* Structure mandatory
* Validation must be concrete
* One skill = one job
* Compression preserves critical behavior
* Update existing before creating

## Gotchas

* Polished skill can be non-executable
* Compression removes important lines first
* Broad framework skills usually weak
* Duplicate skills create confusion

## Do NOT

* Do NOT approve vague validation
* Do NOT ignore missing sections
* Do NOT accept broad catch-all without justification
* Do NOT ignore overlap with existing
* Do NOT treat documentation as workflow skill

## Auto-trigger keywords

* lint skill, validate skill, review skill, check rule
* skill quality, pre-merge check, compression safety

## Anti-patterns

* "Laravel skill" (too broad)
* Missing validation
* Missing output format
* Long explanation without executable steps
* Compressed drops safety checks

## Examples

Fail: Missing validation + overlaps existing skill
Warn: Structure valid, scope too broad — suggest split
Pass: All sections, actionable procedure, concrete validation, no duplication

## Environment notes

Use in CI and PR review. Lint uncompressed first, then validate compressed.
