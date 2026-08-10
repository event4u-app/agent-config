# R2 completion review — feat-inbox-harvest-b-quorum-telemetry

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

- diff: `diff.patch` — the review scope (branch head 12e0bc14f7813691c8708d25b6eb23c8bcf4f116, review
  artefacts excluded), scope hash `f56b17ff0f70cff5639922440276c03362b99aedf4dea81ff60f51f90c7e5f09`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b.md
- src/config/quorum-attendance-budget.json
- src/scripts/ai_council/events_log.ts
- src/scripts/ai_council/quorum.ts
- src/scripts/council_cli.ts
- tests/scripts/ai_council/events_log.test.ts
- tests/scripts/ai_council/quorum.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-inbox-harvest-b-quorum-telemetry.findings.md`:

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
**Honest-null:** 0 findings, scope f56b17ff0f70cff5639922440276c03362b99aedf4dea81ff60f51f90c7e5f09, reviewed <YYYY-MM-DD>
```
