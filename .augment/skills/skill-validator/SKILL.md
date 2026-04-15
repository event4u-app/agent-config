---
name: skill-validator
description: "Use when reviewing or validating skill quality against defined standards and best practices."
source: project
---

# skill-validator

## When to use

* Reviewing existing skill
* Checking skill best practices
* Before committing/merging a skill
* Debugging bad agent behavior from skills

Do not use for creating new skills (use skill-writing) or compressing (use skill-caveman-compression).

## Goal

* Ensure skill quality and consistency
* Detect structural and logical issues
* Prevent weak or misleading skills

## Preconditions

* SKILL.md file exists
* Content complete enough to evaluate

## Decision hints

* Missing Procedure → invalid
* Missing validation → weak
* Too generic → needs refinement
* Too large → needs splitting

## Procedure

### 1. Check structure

Required: When to use, Procedure, Output format, Gotchas, Do NOT

### 2. Evaluate trigger quality

* Description is trigger ("Use when...")?
* "When to use" specific enough?
* "Do not use" present?

### 3. Evaluate procedure

* Steps numbered, actionable, verifiable
* Last step includes concrete validation

### 4. Evaluate validation

* Concrete checks exist — not vague ("check if works")
* Testable conditions

### 5. Evaluate scope

* One clear job — not too broad
* No duplicated concerns across Goal, Core rules, Gotchas

### 6. Detect anti-patterns

* Documentation instead of workflow
* Missing examples
* Obvious content model already knows
* Description too long or not a trigger

## Output format

1. Pass / Fail
2. Issues found
3. Suggested improvements
4. Optional improved snippet

## Core rules

* Every skill must be executable
* Structure mandatory
* Validation required
* Clarity over completeness

## Gotchas

* Skills may look good but be unusable
* Missing validation most common issue
* Broad skills reduce agent effectiveness
* Same idea repeated across sections wastes tokens

## Do NOT

* Do NOT accept vague procedures
* Do NOT ignore missing sections
* Do NOT approve overly generic skills
* Do NOT skip checking description field

## Auto-trigger keywords

* validate skill, review skill, skill quality, improve skill, check skill

## Anti-patterns

* Procedure with only 2 vague steps
* No "Do not use" boundary
* Description summarizes instead of triggers
* Validation says "check if it works"

## Examples

Pass: Clear trigger, 5-step procedure, concrete validation, gotchas, anti-patterns
Fail: Missing procedure, vague trigger, no validation → 3 issues listed
