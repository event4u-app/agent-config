# Roadmap: Taxonomy Audit

> Audit all existing skills, rules, and guidelines against the taxonomy decision matrix.
> Identify misclassified content and correct it.

## Background

The taxonomy decision matrix was added to `skill-writing`, `learning-to-rule-or-skill`,
and `skill-reviewer` skills. It classifies content into 5 categories:

| Category | What it is | Where it lives |
|---|---|---|
| **Rule** | Always-true constraint | `.augment/rules/` |
| **Skill** | Step-by-step workflow with decisions | `.augment/skills/` |
| **Guideline** | Coding convention / reference material | `.augment/guidelines/` |
| **Nothing** | Baseline model knowledge / standard tool usage | Nowhere — do not create |
| **Update** | Refinement of existing guidance | Extend existing file |

**Key principle:** "Not everything needs to be a skill. Most things should be nothing."

## Phase 1: Skill Audit

Audit all ~80 remaining skills against the taxonomy.

### For each skill, ask:

1. Is this baseline model knowledge? → **Delete** (absorb steps into parent skill if needed)
2. Is this a coding convention without workflow? → **Migrate to guideline**
3. Is this an always-true constraint? → **Migrate to rule**
4. Is this a real workflow with decisions and validation? → **Keep as skill**
5. Is this covered by another skill? → **Merge or delete**

### Priority order

1. Skills with `broad_scope` linter warnings
2. Skills under 50 lines (likely too thin to be a real workflow)
3. Skills that are pure tool-usage wrappers
4. Skills that duplicate guidelines

### Output

Update `agents/roadmaps/skills-audit-results.md` with taxonomy classification column.

## Phase 2: Rule Audit

Audit all rules against the taxonomy.

### For each rule, ask:

1. Is this actually a workflow? → **Migrate to skill**
2. Is this a coding convention? → **Migrate to guideline, keep rule as enforcement subset**
3. Is this baseline knowledge? → **Delete**
4. Is this a real always-true constraint? → **Keep as rule**

### Known issue

The `procedural_rule` linter warning already catches some of these. Check current warnings.

## Phase 3: Guideline Audit

Audit guidelines to ensure they don't contain workflow steps.

### For each guideline, ask:

1. Does it contain step-by-step procedures? → **Extract to skill**
2. Is it pure reference material? → **Keep as guideline**
3. Does it overlap with a rule? → **Deduplicate**

## Phase 4: Cross-reference Cleanup

After reclassification:

- [ ] Run linter: 0 FAIL
- [ ] Verify no orphaned references (skills pointing to deleted skills)
- [ ] Update AGENTS.md inventory
- [ ] Run `/compress` on changed files

## Acceptance Criteria

- [ ] Every skill passes the taxonomy pre-check ("Should this be a skill at all?")
- [ ] No baseline-knowledge skills remain
- [ ] No convention-only skills remain (migrated to guidelines)
- [ ] No workflow rules remain (migrated to skills)
- [ ] Linter: 0 FAIL
- [ ] AGENTS.md updated

## Notes

- This audit is best done with `sonnet` — it's classification work, not architecture.
- Process 10-15 files per session.
- When deleting a skill, check if any of its content should be absorbed into a parent skill's procedure steps.
- The taxonomy decision matrix in `skill-writing` is the source of truth for classification.
