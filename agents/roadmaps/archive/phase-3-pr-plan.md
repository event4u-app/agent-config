# Phase 3 — PR Order and Implementation Plan

## Goal

Implement Phase 3 in small, safe pull requests.

Each PR should:

* have one clear purpose
* be easy to review
* avoid mixing policy, tooling, and behavior changes
* improve safety before adding more automation

---

# ✅ PR 1 — Safe optimize commands (sync uncompressed → compressed) — ALREADY DONE

## Purpose

Align the uncompressed source versions of `optimize-skills` and `optimize-agents` with
the already-safe compressed versions. The compressed commands (`.augment/commands/`) already
have: "Suggest only, never auto-apply", Preservation Gate, `disable-model-invocation: true`.
The uncompressed sources still contain dangerous legacy logic.

## What already exists (no changes needed)

* `.augment/commands/optimize-skills.md` — already safe (advisory only, preservation gate)
* `.augment/commands/optimize-agents.md` — already safe (advisory only, preservation gate)

## Files to change

* `.augment.uncompressed/commands/optimize-skills.md` — sync to match compressed version's safe design
* `.augment.uncompressed/commands/optimize-agents.md` — sync to match compressed version's safe design

## Specific problems in uncompressed versions

### `optimize-skills.md` (uncompressed)

* Still references `.augment/skills/` instead of `.augment.uncompressed/`
* Contains Killer 1–5 checks that duplicate the linter (`scripts/skill_linter.py`)
* Has auto-apply options ("Apply all merge/delete recommendations")
* Adds Gotcha sections and rewrites descriptions — should be audit-only

### `optimize-agents.md` (uncompressed)

* Description says "optimizes" instead of "audits"
* Missing `disable-model-invocation: true` in frontmatter
* Broader scope than the safe compressed version

## Changes

For both files: rewrite uncompressed source to match the safe compressed version's structure:

* advisory only, never auto-apply
* read from `.augment.uncompressed/`
* preservation gate mandatory before any suggestion
* delegate quality checks to linter and skill-reviewer
* add `disable-model-invocation: true` to frontmatter

Then run `/compress` to sync.

## Acceptance criteria

* uncompressed and compressed versions are aligned
* commands are advisory only in both versions
* no auto-apply options remain
* linter passes after changes

---

# ✅ PR 2 — Quality summary artifact (extend existing) — DONE

## Purpose

Add CI artifact upload and small improvements to the existing lint reporting.

## What already exists (no reimplementation needed)

* `skill_linter.py` has `format_json()` with `summary` block (pass/warn/fail/total)
* `skill_linter.py` has `format_report()` with score per type + top issues
* `--report` and `--format json` flags exist
* `Taskfile.yml` has `lint-skills-json` target

## Files to change

* `scripts/skill_linter.py` — add `files_with_most_issues` to `format_report()`
* `Taskfile.yml` — add `lint-skills-report` target
* `.github/workflows/skill-lint.yml` — add artifact upload step for JSON + report output

## Changes

### Linter extension

Add to `format_report()`:

* files with most warnings/errors (top 10)
* issue code frequency table (already partially exists, extend)

### Taskfile

Add: `task lint-skills-report` → `python3 scripts/skill_linter.py --all --report`

### CI

Upload JSON artifact on every lint run using `actions/upload-artifact`.

## Acceptance criteria

* `task lint-skills-report` produces human-readable health overview
* CI stores lint summary as downloadable artifact
* report includes top failing files

---

# ✅ PR 3 — Pointer-only / weak-skill detection — ALREADY IMPLEMENTED

## Purpose

Detect skills that are structurally correct but operationally too weak.

## Files to change

### Script

* `scripts/skill_linter.py`

### Tests

* `tests/test_skill_linter.py`
* add fixtures for:

  * pointer-only skill
  * guideline-heavy but acceptable skill
  * strong self-contained skill

## Changes

Add warning/error heuristics for:

* too many guideline/doc references
* too few real action verbs
* too-thin procedure
* effectively non-executable skill

Suggested issue codes:

* `pointer_only_skill`
* `guideline_dependent_skill`

## Acceptance criteria

* linter can flag pointer-only skills
* false positives remain acceptable
* warnings first, not global hard-fail at the start

---

# ✅ PR 4 — Preservation guards for merges and compression — DONE

## Purpose

Prevent merges, refactors, and compression from silently reducing skill quality.
Combines the original PR 4 (merge preservation) and PR 5 (compression preservation)
since both target the same concern: quality loss during transformation.

## What already exists

* `/compress` command has a 10-point "Compression quality checklist"
* `skill-reviewer` has "Compression safety" checks
* `skill_linter.py` has `check_compression_quality()` for section survival
* `skill-management` skill has preservation guidance

## Files to change

### New rule

* `.augment.uncompressed/rules/preservation-guard.md` — single rule covering both merge and compression preservation

### Skills to update

* `.augment.uncompressed/skills/skill-reviewer/SKILL.md` — add merge preservation checks
* `.augment.uncompressed/skills/skill-management/SKILL.md` — reference new rule

### Existing compression docs to strengthen

* `.augment.uncompressed/commands/compress.md` — reference new rule from quality checklist

## Changes

### New `preservation-guard` rule

For any merge, refactor, or compression:

* preserve strongest validation step
* preserve strongest example
* preserve strongest anti-pattern
* preserve essential decision hints
* preserve required sections
* preserve single clear responsibility

### Reviewer integration

Add to `skill-reviewer` procedure:

* check for quality loss when reviewing merge/refactor PRs
* reference preservation-guard rule

## Acceptance criteria

* preservation policy exists as a rule (always-loaded)
* reviewer checks for loss of examples/validation/anti-patterns
* compression checklist references the rule
* linter passes after changes

---

# ✅ PR 5 — Compression-aware linting (extend existing) — DONE

## Purpose

Extend the existing `check_compression_quality()` with deeper heuristics.

## What already exists

* `skill_linter.py` has `check_compression_quality()` — checks section survival
* `skill_linter.py` has `check_compression_pairs()` — checks pair existence
* `--pairs` and `--compression-quality` flags exist
* Taskfile has no dedicated pairs target yet

## Files to change

* `scripts/skill_linter.py` — extend `check_compression_quality()`
* `tests/test_skill_linter.py` — add pair comparison test fixtures
* `Taskfile.yml` — add `lint-skills-pairs` target

## Changes

Extend `check_compression_quality()` to also check:

* validation keyword preservation (verify, confirm, must pass, run test)
* code block / example count (compressed should have ≥ source count)
* anti-pattern / "Do NOT" bullet count
* decision-hint keywords (if/when/unless/prefer)

Start simple — heuristic keyword counting, no semantic analysis.

Suggested new issue codes:

* `compression_lost_validation`
* `compression_lost_example`
* `compression_lost_antipattern`

## Acceptance criteria

* pair checks catch obvious quality loss beyond missing sections
* `task lint-skills-pairs` runs the extended checks
* tests cover positive and negative cases

---

# ✅ PR 6 — Feedback aggregation (lightweight) — DONE

## Purpose

Add structured categories to the existing feedback capture system.

## What already exists

* `capture-learnings` rule (always-loaded) — triggers learning capture
* `learning-to-rule-or-skill` skill — classifies and creates rules/skills
* `skill-improvement-pipeline` skill — orchestrates the full improvement cycle
* `skill-improvement-trigger` rule — triggers pipeline after task completion

## Files to change

* `.augment.uncompressed/skills/skill-improvement-pipeline/SKILL.md` — add category enum to capture phase
* `.augment.uncompressed/skills/learning-to-rule-or-skill/SKILL.md` — add category tags to classification step

### Optional new file

* `.augment.uncompressed/contexts/feedback-categories.md` — reference document for category definitions

## Changes

Add feedback category tags to the existing pipeline:

* `skill-weakness` — skill gave wrong or incomplete guidance
* `rule-weakness` — rule was too vague or missed a case
* `routing-issue` — wrong skill was selected
* `assumption-issue` — agent made bad assumptions
* `verification-gap` — verification step was missing or weak
* `optimization-overreach` — optimize command suggested harmful change

No separate script needed — categories are used within the existing skill pipeline.

## Acceptance criteria

* learnings can be tagged with a category
* pipeline uses categories for prioritization
* no new runtime infrastructure required

---

# ✅ PR 7 — Quality report (extend existing --report) — DONE

## Purpose

Extend the existing `--report` flag with per-file details and CI artifact upload.

## What already exists

* `skill_linter.py` has `format_report()` — score per type, top issues table
* `--report` flag triggers the report output
* Score formula: pass=10, warn=8, fail=3

## Files to change

* `scripts/skill_linter.py` — extend `format_report()` with per-file details
* `Taskfile.yml` — ensure `lint-skills-report` target exists (from PR 2)
* `.github/workflows/skill-lint.yml` — upload report as CI artifact (may already be done in PR 2)

## Changes

Extend `format_report()` to include per-file detail table:

* file name
* structure: pass/fail
* validation: strong/weak (based on existing `missing_validation` check)
* scope: focused/broad (based on existing `broad_scope` check)
* compression risk: low/medium/high (based on pair-check results from PR 5)

Keep it simple — derive all classifications from existing linter issue codes.
No new analysis engine, just reformatting existing data.

## Acceptance criteria

* `--report` shows per-file quality breakdown
* weak areas are visible without manual digging
* report artifact is available in CI

---

# ✅ PR 8 — PR summary comment / reviewer output — DONE

## Purpose

Make CI findings easy to consume.

## Files to change

### CI

* `.github/workflows/skill-lint.yml`
* optional new workflow or comment step

### Optional script

* `scripts/pr_summary.py`

## Changes

Generate markdown PR summary:

* pass / warn / fail totals
* changed files with issues
* top 3 actions required
* links to artifacts

## Acceptance criteria

* PR reviewers can understand quality impact quickly
* no need to open raw JSON unless deeper inspection is needed

---

# Implementation order (8 PRs, renumbered)

## Core safety first

1. PR 1 — Safe optimize commands (sync uncompressed → compressed)
2. PR 3 — Pointer-only / weak-skill detection
3. PR 4 — Preservation guards (merges + compression combined)

## Visibility next

4. PR 2 — Quality summary artifact (extend existing linter)
5. PR 7 — Quality report (extend existing --report)

## Compression hardening next

6. PR 5 — Compression-aware linting (extend existing pair checks)

## Feedback intelligence last

7. PR 6 — Feedback aggregation (lightweight, no new scripts)
8. PR 8 — PR summary comment

---

# Recommended first batch

## Batch A (best ROI)

* PR 1 — smallest scope, highest safety impact
* PR 3 — new detection capability
* PR 4 — preservation policy

This gives you safer commands, stronger weak-skill detection, and quality preservation.

---

# Review strategy

For each PR, verify:

* does it reduce risk?
* does it avoid duplicate logic?
* does it preserve source-of-truth model?
* does it improve clarity more than it increases complexity?

Reject if:

* too many concerns are mixed
* policy and implementation are mixed without need
* automation is stronger than the guardrails protecting it

---

# Final target state

After these PRs, the package should have:

* strong structure
* strong enforcement
* strong observability
* safe optimization
* compression safety
* feedback-driven improvement

Target outcome:

> A governed, observable, self-improving agent configuration system with safe evolution paths
