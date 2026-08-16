# R2 completion review — feat-scheduled-deprecation

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

- diff: `diff.patch` — the review scope (branch head f5873b283cd6beb59528f346a552a60846f9ae9d, review
  artefacts excluded), scope hash `1f6931ad909f1f146c728b8aae3f9f02e8132e9e1640d9769822bc8e761e5efc`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- Taskfile.yml
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-d-scheduled-deprecation.md
- docs/MIGRATION.md
- docs/release-runbook.md
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json
- src/scripts/lint_scheduled_deprecations.ts
- src/scripts/release.ts
- taskfiles/ci-fast.yml
- tests/scripts/lint_scheduled_deprecations.test.ts
- tests/scripts/release.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-scheduled-deprecation.findings.md`:

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
**Honest-null:** 0 findings, scope 1f6931ad909f1f146c728b8aae3f9f02e8132e9e1640d9769822bc8e761e5efc, reviewed <YYYY-MM-DD>
```
