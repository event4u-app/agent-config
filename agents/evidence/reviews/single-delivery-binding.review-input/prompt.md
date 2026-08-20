# R2 completion review — single-delivery-binding

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

- diff: `diff.patch` — the review scope (branch head e9668fd7d8f74b67521d82ff838059e955e036bc, review
  artefacts excluded), scope hash `34f1366096d98a97a52183fe86ad074d237a4e2e9ed3dd1e7ddd7b6dd51a4a78`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-single-delivery.md
- src/config/estate-count-budget.json
- taskfiles/ci-fast.yml
- tests/scripts/preflight_single_delivery_binding.test.ts

## Output format (contract §2.2)

Fill the findings table in `single-delivery-binding.findings.md`:

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
**Honest-null:** 0 findings, scope 34f1366096d98a97a52183fe86ad074d237a4e2e9ed3dd1e7ddd7b6dd51a4a78, reviewed <YYYY-MM-DD>
```
