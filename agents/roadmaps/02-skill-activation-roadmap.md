# Skill Activation + Boundary Hygiene Roadmap

## Problem

- 0 of ~80 skills have an `execution:` block — the runtime infrastructure has nothing to work with
- `runtime-safety.md` triggers a `procedural_rule` linter warning — boundary between rule and skill is blurred
- No classification exists that maps skills to execution types

## Goal

- Classify and tag all skills with correct execution metadata
- Fix boundary violations (rules that are too procedural)
- Verify the full runtime registry works with real skill data

## What this changes for the user

- `task runtime-list` shows real skills grouped by execution type
- `task lifecycle-health` reflects actual skill quality
- Linter runs clean: 0 warnings, 0 boundary violations

## PR series

### PR 1: Skill classification matrix

Analyze all ~80 skills and create a classification document.

**Deliverables:**
- New: `agents/docs/skill-classification.md` — table with columns:
  skill name | execution type | handler | allowed_tools | rationale
- Classification criteria:
  - `automated`: pure CLI/linter skills (quality-fix, compress, commit, package-test)
  - `assisted`: interactive skills needing confirmation (create-pr, fix-pr-comments, jira-ticket, bug-fix)
  - `manual`: instructional/knowledge skills (laravel, php-coder, eloquent, security)

**Acceptance:**
- Every skill in `.augment.uncompressed/skills/` is classified
- Rationale column explains why each type was chosen
- Review before proceeding to PR 2

---

### PR 2: Tag automated skills

Add `execution:` blocks to all skills classified as `automated`.

**Files:**
- Modified: ~10-15 SKILL.md files (quality-fix, compress, commit, package-test, etc.)
- Each gets: `execution: { type: automated, handler: shell|internal, safety_mode: strict, allowed_tools: [] }`

**Acceptance:**
- `task lint-skills` passes with 0 errors on modified skills
- `task runtime-list` shows all tagged automated skills
- `task runtime-validate` passes

---

### PR 3: Tag assisted skills

Add `execution:` blocks to all skills classified as `assisted`.

**Files:**
- Modified: ~15-20 SKILL.md files (create-pr, fix-pr-comments, jira-ticket, bug-fix, etc.)
- Each gets: `execution: { type: assisted, handler: internal, allowed_tools: [github] | [jira] | [] }`

**Acceptance:**
- `task lint-skills` passes with 0 errors
- `task runtime-list` shows assisted skills with correct tool declarations
- Tool declarations match actual tool usage in skill procedures

---

### PR 4: Boundary hygiene — fix procedural_rule warnings

Fix `runtime-safety.md` and any other rules that trigger `procedural_rule`.
Sharpen the boundary: rules declare constraints, skills describe procedures.

**Approach:**
- Audit all rules for procedural content (step-by-step instructions belong in skills)
- Refactor `runtime-safety.md`: keep constraints, move procedure to skill reference
- Run `task lint-skills --all` to verify 0 warnings

**Files:**
- Modified: `.augment.uncompressed/rules/runtime-safety.md`
- Modified: `.augment/rules/runtime-safety.md` (compressed)
- Potentially other rules if `procedural_rule` warnings exist

**Acceptance:**
- `task lint-skills --all` shows 0 `procedural_rule` warnings
- Rules contain only constraints, conditions, and escalation paths
- Procedural content lives in skills or guidelines

## Dependencies

- Roadmap 1 (E2E Integration) should be at least partially done so tagged skills can be verified
- Classification review (PR 1) blocks PR 2 and PR 3

## Risk

- Mistagging a skill (wrong execution type)
- Mitigation: classification review, conservative default (prefer `manual` over `assisted`)
