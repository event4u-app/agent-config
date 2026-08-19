# R2 completion review — fix-injection-budget-emission-and-session-state

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

- diff: `diff.patch` — the review scope (branch head 7f656558c9beb91353a0cb2031ef99023f2d5641, review
  artefacts excluded), scope hash `6ccd3bc3893f819410a37a4371ea2bdfbc80eb820c06fe7c09e0380ebd17d115`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- src/scripts/bench_hook_injection.ts
- src/scripts/hooks/host_semantics.ts
- src/scripts/hooks/injection_budget.ts
- tests/hooks/injection_budget_dispatch.test.ts
- tests/scripts/hooks/injection_budget.test.ts

## Output format (contract §2.2)

Fill the findings table in `fix-injection-budget-emission-and-session-state.findings.md`:

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
**Honest-null:** 0 findings, scope 6ccd3bc3893f819410a37a4371ea2bdfbc80eb820c06fe7c09e0380ebd17d115, reviewed <YYYY-MM-DD>
```
