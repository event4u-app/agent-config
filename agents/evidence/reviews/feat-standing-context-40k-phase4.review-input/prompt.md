# R2 completion review — feat-standing-context-40k-phase4

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

- diff: `diff.patch` — the review scope (branch head b7f6aaed3a0fc4fca256db3521f2714768a4410a, review
  artefacts excluded), scope hash `3a8b913921438a63ab87a4045f16b6945937e35ced463d0703080488da60173c`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-standing-context-40k.md
- src/config/hook-token-budget.json
- src/scripts/bench_hook_injection.ts
- src/scripts/hooks/dispatch_hook.ts
- src/scripts/hooks/dispatch_issues.ts
- src/scripts/hooks/turn_injection_budget.ts
- tests/eval/nudge-interference/user-prompt-submit.yaml
- tests/scripts/hooks/dispatch_issues.test.ts
- tests/scripts/hooks/nudge_interference.test.ts
- tests/scripts/hooks/turn_injection_budget.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-standing-context-40k-phase4.findings.md`:

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
**Honest-null:** 0 findings, scope 3a8b913921438a63ab87a4045f16b6945937e35ced463d0703080488da60173c, reviewed <YYYY-MM-DD>
```
