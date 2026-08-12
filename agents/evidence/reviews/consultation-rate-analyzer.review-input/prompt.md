# R2 completion review — consultation-rate-analyzer

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

- diff: `diff.patch` — the review scope (branch head 347cb4702b55f22723ecf4d7fb00fe202fb4d72c, review
  artefacts excluded), scope hash `be0b4351f847ae1f7d1443a7519fcc724c3c09fe1e3b2d51e428731a1f6abe0e`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-frontend-skill-application.md
- agents/settings/contexts/skill-catalogue-baseline.md
- src/scripts/report_consultation_rate.ts
- tests/scripts/consultation_rate.test.ts

## Output format (contract §2.2)

Fill the findings table in `consultation-rate-analyzer.findings.md`:

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
**Honest-null:** 0 findings, scope be0b4351f847ae1f7d1443a7519fcc724c3c09fe1e3b2d51e428731a1f6abe0e, reviewed <YYYY-MM-DD>
```
