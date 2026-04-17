# Skill Activation + Boundary Hygiene Roadmap

## Problem

- 0 of ~80 skills have an `execution:` block — the runtime infrastructure has nothing to work with
- `runtime-safety.md` triggers a `procedural_rule` linter warning — boundary between rule and skill is blurred
- No formal classification standard exists — tagging without criteria leads to inconsistency

## Goal

- Define a **classification standard** with clear criteria before tagging any skills
- Classify and tag all skills with correct execution metadata
- Fix boundary violations (rules that are too procedural)
- Verify the full runtime registry works with real skill data

## What this changes for the user

- `task runtime-list` shows real skills grouped by execution type
- `task lifecycle-health` reflects actual skill quality
- Linter runs clean: 0 warnings, 0 boundary violations

## PR series

### PR 1: Execution Classification Standard

Define the formal rules for classifying skills **before** tagging any of them.

**Deliverables:**
- New: `agents/docs/execution-classification-standard.md`

**Contents:**

#### Manual criteria (knowledge/instructional skills)

A skill is `manual` when:
- It provides knowledge, patterns, or conventions (not steps to execute)
- It has no deterministic input → output flow
- It requires human judgment for every decision
- Examples: `laravel`, `php-coder`, `eloquent`, `security`, `database`

#### Assisted criteria (interactive workflow skills)

A skill is `assisted` when:
- It follows a multi-step workflow requiring user confirmation at key points
- It reads external state (GitHub, Jira, codebase) and proposes actions
- The user must approve before any write operation
- Examples: `create-pr`, `fix-pr-comments`, `jira-ticket`, `bug-fix`

#### Automated criteria (self-running skills)

A skill is `automated` **only** when ALL of these are true:
- **Deterministic** — same input produces predictable output
- **Reversible** — changes can be undone (git reset, file restore)
- **Locally verifiable** — success/failure can be checked immediately
- **Bounded scope** — affects only specific files, never external systems
- **No destructive side effects** — no data loss, no external writes
- **No content alignment needed** — no user judgment required for output quality
- Examples: `compress`, `quality-fix`, `package-test`

⚠️ **`commit` is NOT automated** — it creates git history that affects collaboration.
Classify as `assisted` despite being CLI-based.

#### Handler rules

| Handler | When to use |
|---|---|
| `none` | Manual skills (no execution) |
| `shell` | Runs CLI commands |
| `internal` | Agent-internal workflow |

#### allowed_tools rules

- Only declare tools the skill **actually calls** (GitHub API, Jira API, etc.)
- Empty `[]` for skills that don't use external tools
- Never declare tools "just in case"

#### Migration rules for existing skills

- Default to `manual` when uncertain — upgrade later with evidence
- Never tag `automated` without reviewing all 6 criteria above
- Batch PRs by execution type (automated first, then assisted)

**Acceptance:**
- Standard is reviewed and approved before any tagging begins
- All criteria are concrete and testable (not vague)
- Edge cases are documented with rationale

---

### PR 2: Skill classification matrix + tag automated skills

Apply the standard to all ~80 skills and tag the automated ones first.

**Deliverables:**
- New: `agents/docs/skill-classification.md` — table with columns:
  skill name | execution type | handler | allowed_tools | rationale
- Modified: ~8-12 SKILL.md files classified as `automated`
- Each gets: `execution: { type: automated, handler: shell|internal, safety_mode: strict, allowed_tools: [] }`

**Acceptance:**
- Every skill in `.augment.uncompressed/skills/` is classified in the matrix
- Rationale column references specific criteria from the standard
- `task lint-skills` passes with 0 errors on modified skills
- `task runtime-list` shows all tagged automated skills

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

- Classification standard (PR 1) blocks all tagging PRs
- Classification review blocks PR 2 and PR 3

## Risk

- Mistagging a skill (wrong execution type)
- Mitigation: formal standard with 6 criteria for automated, conservative default (prefer `manual`)
- `commit` or similar CLI skills incorrectly tagged as `automated`
- Mitigation: explicit exclusion list in the standard for "CLI but not automated" skills
