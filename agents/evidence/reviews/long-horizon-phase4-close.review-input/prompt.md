# R2 completion review — long-horizon-phase4-close

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

- diff: `diff.patch` — the review scope (branch head 4158e9e4278a987163eadb097ff626d371ad6f7c, review
  artefacts excluded), scope hash `9e2fb9b2b13cb2b751e38fc3e2359af5867a7cb39395921d47572a23587a8d5d`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-long-horizon-execution.md
- docs/CLAIMS.md
- src/scripts/_lib/headless_invocation.ts
- src/scripts/_lib/run_checkpoint.ts
- src/scripts/interruption_report.ts
- src/scripts/run_supervise.ts
- tests/scripts/headless_invocation.test.ts
- tests/scripts/interruption_report.test.ts
- tests/scripts/run_supervise.test.ts

## Output format (contract §2.2)

Fill the findings table in `long-horizon-phase4-close.findings.md`:

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
**Honest-null:** 0 findings, scope 9e2fb9b2b13cb2b751e38fc3e2359af5867a7cb39395921d47572a23587a8d5d, reviewed <YYYY-MM-DD>
```
