# R2 completion review — fix-gate-completeness-new-arrivals

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

- diff: `diff.patch` — the review scope (branch head c9753b151dfd7a0aa95af08e59cff298c4220318, review
  artefacts excluded), scope hash `f90f591a10ff4c24b9dd4eca754f797daf5d87c3cc182a627ddadd8430c34f07`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- src/config/gate-violation-baselines.json
- src/config/hook-latency-budget.json
- src/scripts/bench_hook_latency.ts
- src/scripts/build_archive_index.ts
- src/scripts/check_gate_coverage.ts
- src/scripts/check_pr_ci_current.ts
- tests/scripts/check_gate_coverage.test.ts

## Output format (contract §2.2)

Fill the findings table in `fix-gate-completeness-new-arrivals.findings.md`:

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
**Honest-null:** 0 findings, scope f90f591a10ff4c24b9dd4eca754f797daf5d87c3cc182a627ddadd8430c34f07, reviewed <YYYY-MM-DD>
```
