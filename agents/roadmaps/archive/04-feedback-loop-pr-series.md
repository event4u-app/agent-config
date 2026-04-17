# Feedback Loop — Concrete PR Series

**Status: ✅ COMPLETE**

## Goal

Turn repeated failures, corrections, and friction into durable system improvements.

## Outcome after this series

The system should support:

- [x] structured feedback categories
- [x] repeated pattern detection
- [x] improvement suggestions
- [x] evidence-based prioritization

---

# PR 1 — Feedback taxonomy and storage format ✅

## Objective

Define what kinds of feedback the system understands.

## Files to create

- `.augment.uncompressed/guidelines/feedback-loop.md`
- `docs/feedback-taxonomy.md`
- `schemas/feedback.schema.json` (optional)
- `scripts/feedback_store.py`
- `tests/test_feedback_store.py`

## Suggested categories

- skill weakness
- rule weakness
- routing issue
- assumption issue
- verification gap
- tool permission issue
- runtime issue
- optimize-command overreach

## Acceptance criteria

- feedback categories are explicit
- storage format exists and is testable

---

# PR 2 — Capture repeated failure patterns ✅

## Objective

Record structured feedback from lint/review/runtime outcomes.

## Files to update

- `scripts/skill_linter.py`
- `scripts/runtime_execute.py`
- `scripts/metrics_aggregate.py`

## Features

Capture signals from:
- repeated lint failures
- repeated warnings
- runtime denials
- repeated user-correction categories (if represented structurally)

## Acceptance criteria

- repeated issues can be counted
- the same problem across files/runs is visible

---

# PR 3 — Suggest improvement candidates ✅

## Objective

Generate non-destructive suggestions from repeated signals.

## Files to create

- `scripts/feedback_suggestions.py`
- `tests/test_feedback_suggestions.py`

## Output examples

- candidate rule addition
- candidate skill refactor
- candidate linter enhancement
- candidate guideline clarification

## Important rule

Suggestions only.
Never auto-apply.

## Acceptance criteria

- repeated patterns produce structured suggestions
- suggestions are categorized and reviewable

---

# PR 4 — Promotion thresholds and human review gate ✅

## Objective

Control when feedback turns into roadmap / implementation work.

## Files to create/update

- `.augment.uncompressed/rules/capture-learnings.md`
- `learning-to-rule-or-skill`
- `docs/promotion-thresholds.md`

## Threshold examples

- repeated 3+ times → candidate improvement
- repeated across 2+ artifact types → candidate rule/linter change
- repeated after prior fix → escalate severity

## Acceptance criteria

- promotion logic is documented
- human review gate is explicit
- no automated self-modification happens

---

# PR 5 — Feedback summary report ✅

## Objective

Make the loop visible in CI and maintenance workflows.

## Files to create

- `scripts/feedback_report.py`
- `tests/test_feedback_report.py`

## CI changes

- upload feedback summary artifact
- optionally include top recurring patterns in PR summary

## Acceptance criteria

- maintainers can see top recurring failure patterns
- improvements can be prioritized with evidence

---

# Suggested sequencing notes

- start with taxonomy, not AI auto-refinement
- do not automate changes, only suggestions
- integrate with observability output where possible
