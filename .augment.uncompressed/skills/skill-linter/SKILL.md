---
name: skill-linter
description: "Use when validating skills or rules for structure, quality, duplication risk, and compression safety before merge or release."
source: project
---

# skill-linter

## When to use

Use this skill when:

* Reviewing a new or changed SKILL.md file
* Reviewing a new or changed rule
* Checking whether a compressed skill is still safe
* Running quality checks before merge
* Preparing an upstream contribution

Do not use this skill when:

* Content is still incomplete and not ready for review
* Creating a skill from scratch without a draft yet
* You only want stylistic feedback without pass/fail criteria

## Goal

* Detect weak, incomplete, or misleading skills and rules
* Enforce structural standards
* Prevent duplication and over-broad guidance
* Ensure compressed versions preserve critical behavior

## Preconditions

* A draft or changed skill/rule exists
* Source-of-truth file is available
* If compression used, compressed file also available

## Decision hints

* Missing Procedure or Output format → fail
* Validation is vague → fail
* Broad enough for multiple workflows → warn or fail
* Compression removes validation or trigger clarity → fail
* Existing guidance covers the topic → warn for duplication

## Procedure

### 0. Identify artifact type

Determine: skill, rule, compressed skill, or uncompressed skill.

### 1. Validate structure

**Skills** — required sections:
* When to use (with "Do not use when")
* Procedure (with Step 0: Inspect + concrete validation)
* Output format
* Gotchas
* Do NOT

**Rules** — must be:
* Short and directive
* Always-applicable
* Not procedural (no numbered steps)

### 2. Validate trigger quality

* Description starts with trigger-oriented phrase ("Use when...")
* "When to use" is specific enough to match reliably
* Scope narrow enough to be actionable
* Description under 200 chars

### 3. Validate procedure quality

* Steps numbered or clearly ordered
* Steps are executable (not "think about X")
* Final validation step exists with concrete checks
* Step 0 (Inspect) present

### 4. Validate output quality

* Output format defined
* Controls verbosity or response shape
* Matches the purpose of the skill

### 5. Validate anti-failure coverage

* Gotchas contain real failure patterns
* Do NOT contains enforceable constraints
* Anti-patterns included if preventing recurring mistakes

### 6. Validate duplication and scope

* No similar skill already exists (name + description overlap)
* No overlap with another skill or rule
* Single workflow per file (not multiple unrelated workflows)
* Update existing preferred over new file

### 7. Validate compression safety

If compressed version exists, verify it still contains:
* Trigger clarity
* Decision hints or equivalent
* Concrete validation
* Gotchas or anti-failure protection

### 8. Produce verdict

Return: **pass**, **pass with warnings**, or **fail**

## Output format

1. Verdict (pass / warn / fail)
2. Issues by severity (error / warning / info)
3. Suggested fixes
4. Optional: exact sections to rewrite
5. Optional: split / merge / deprecate recommendation

## Core rules

* Structure is mandatory
* Validation must be concrete
* One skill = one job
* Compression must preserve critical behavior
* Update existing before creating duplicates

## Gotchas

* A skill can look polished while being non-executable
* Compression often removes the most important lines first
* Broad framework skills are usually weak
* Duplicate skills create confusion even if individually good

## Do NOT

* Do NOT approve vague validation
* Do NOT ignore missing required sections
* Do NOT accept broad catch-all skills without strong justification
* Do NOT ignore overlap with existing guidance
* Do NOT treat documentation as a workflow skill

## Auto-trigger keywords

* lint skill
* validate skill
* review skill
* check rule
* skill quality
* pre-merge check
* compression safety

## Anti-patterns

* "Laravel skill" (too broad)
* Missing validation step
* Output format missing
* Long explanation without executable steps
* Compressed version drops safety-critical checks

## Examples

Fail: "Skill missing concrete validation and overlaps with existing markdown safety skill."
Pass with warnings: "Structure valid, but scope may be too broad — likely should be split."
Pass: "All sections present, procedure actionable, validation concrete, no duplication."

## Environment notes

Use in CI and during PR review.
Lint uncompressed source first, then validate compressed derivative.
