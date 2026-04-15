---
name: skill-validator
description: "Use when reviewing or validating skill quality against defined standards and best practices."
source: project
---

# skill-validator

## When to use

Use this skill when:

* Reviewing an existing skill
* Checking if a skill follows best practices
* Before committing or merging a skill
* Debugging bad agent behavior caused by skills

Do not use this skill when:

* Creating a new skill from scratch (use skill-writing)
* Compressing a skill (use skill-caveman-compression)

## Goal

* Ensure skill quality and consistency
* Detect structural and logical issues
* Prevent weak or misleading skills

## Preconditions

* A SKILL.md file exists
* Skill content is complete enough to evaluate

## Decision hints

* If missing Procedure → invalid skill
* If missing validation → weak skill
* If too generic → needs refinement
* If too large → needs splitting

## Procedure

### 1. Check structure

Verify sections exist:

* When to use
* Procedure
* Output format
* Gotchas
* Do NOT

### 2. Evaluate trigger quality

* Is description a trigger (starts with "Use when...")?
* Is "When to use" specific enough to match reliably?
* Is "Do not use" present to prevent false triggers?

### 3. Evaluate procedure

* Steps are numbered
* Steps are actionable
* Steps are verifiable
* Last step includes concrete validation

### 4. Evaluate validation

* Concrete checks exist
* Not vague ("check if works")
* Testable conditions

### 5. Evaluate scope

* One clear job
* Not too broad
* No duplicated concerns across Goal, Core rules, and Gotchas

### 6. Detect anti-patterns

* Documentation instead of workflow
* Missing examples
* Obvious content the model already knows
* Description too long or not a trigger

## Output format

1. Pass / Fail
2. List of issues found
3. Suggested improvements
4. Optional improved snippet

## Core rules

* Every skill must be executable
* Structure is mandatory
* Validation is required
* Clarity over completeness

## Gotchas

* Skills may look good but be unusable in practice
* Missing validation is the most common issue
* Overly broad skills reduce agent effectiveness
* Same idea repeated across sections wastes tokens

## Do NOT

* Do NOT accept vague procedures
* Do NOT ignore missing sections
* Do NOT approve overly generic skills
* Do NOT skip checking the description field

## Auto-trigger keywords

* validate skill
* review skill
* skill quality
* improve skill
* check skill

## Anti-patterns

* Procedure with only 2 vague steps
* No "Do not use" boundary
* Description that summarizes instead of triggers
* Validation step that says "check if it works"

## Examples

Request: "Review this skill"

Pass example:
* Clear trigger, 5-step procedure, concrete validation, gotchas, anti-patterns → Pass

Fail example:
* Missing procedure, vague trigger, no validation → Fail with 3 issues listed
