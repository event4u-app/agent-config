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

## Phase 1: Skill Audit — ✅ COMPLETE

### Method

1. Sorted all skills by line count (smallest first — most likely to be too thin)
2. Read the 20 smallest skills (59-96 lines) in full
3. Scanned all 6 `broad_scope` skills
4. Automated scan for guideline-redirect patterns and thin procedures

### Results

- **2 deleted:** `naming` (guideline redirect), `github-action-docs` (generic template)
- **6 broad_scope reviewed:** all legitimate (aws-infrastructure, laravel, laravel-reverb, learning-to-rule-or-skill, pest-testing, project-docs)
- **Remaining ~87 skills:** all have real workflows, no guideline-redirect patterns, no thin procedures
- **0 further candidates** for deletion or migration

## Phase 2: Rule Audit — ✅ COMPLETE

### Method

Checked all 10 rules with `procedural_rule` linter warning.

### Results

All 10 are legitimate always-active constraints that use numbered steps to describe enforcement, not on-demand workflows. No action needed:

analysis-skill-routing, augment-source-of-truth, capture-learnings, dev-efficiency,
docs-sync, e2e-testing, guidelines, quality-workflow, token-efficiency, verify-before-complete

## Phase 3: Guideline Audit — ✅ COMPLETE

Guidelines are conventions/reference material by definition. No procedure sections found.
One cross-reference cleaned: `php/naming.md` removed dead `naming` skill reference.

## Phase 4: Cross-reference Cleanup — ✅ COMPLETE

- [x] Linter: 0 FAIL / 164 total
- [x] Orphaned references cleaned (naming.md)
- [x] Symlinks regenerated via `task generate-tools`
- [x] All changes compressed

## Acceptance Criteria

- [x] Every skill passes the taxonomy pre-check
- [x] No baseline-knowledge skills remain
- [x] No convention-only skills remain
- [x] No workflow rules remain (all procedural rules are legitimate constraints)
- [x] Linter: 0 FAIL
- [x] Cross-references cleaned

## Notes

- This audit is best done with `sonnet` — it's classification work, not architecture.
- Process 10-15 files per session.
- When deleting a skill, check if any of its content should be absorbed into a parent skill's procedure steps.
- The taxonomy decision matrix in `skill-writing` is the source of truth for classification.
