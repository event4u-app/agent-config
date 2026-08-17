# R2 completion review — feat-gate-autonomy

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head 186ddaa747062b527400676967d14676a8dd672f, review
  artefacts excluded), scope hash `1cb04bbc674104e6134c12ecf4eaf07cd29a0cdfcc8f80f56a75747ce6ca4c34`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/gate-class-sweep-2026-08-17.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-gate-autonomy.md
- dist/agent-src/scripts/gate_execute.ts
- dist/agent-src/scripts/resume_probe.ts
- dist/agent-src/scripts/roadmap_gates.ts
- dist/agent-src/scripts/update_roadmap_progress.ts
- dist/agent-src/templates/roadmaps.md
- src/agent-src/scripts/gate_execute.ts
- src/agent-src/scripts/resume_probe.ts
- src/agent-src/scripts/roadmap_gates.ts
- src/agent-src/scripts/update_roadmap_progress.ts
- src/agent-src/templates/roadmaps.md
- src/scripts/lint_roadmap_blockers.ts
- tests/scripts/gate_execute.test.ts
- tests/scripts/lint_roadmap_blockers.test.ts
- tests/scripts/resume_probe.test.ts
- tests/scripts/update_roadmap_progress.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-gate-autonomy.findings.md`:

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending
  by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- A row is LIVE wherever it appears — a code fence around it changes
  nothing. If you quote the template as an illustration, its Status cell
  must be exactly `example`, or the gate reads it as a real finding.
- 0 findings → replace the table with exactly this honest-null line
  (contract §2.3):

```markdown
**Honest-null:** 0 findings, scope 1cb04bbc674104e6134c12ecf4eaf07cd29a0cdfcc8f80f56a75747ce6ca4c34, reviewed <YYYY-MM-DD>
```
