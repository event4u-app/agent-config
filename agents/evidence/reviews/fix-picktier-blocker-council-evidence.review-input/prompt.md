# R2 completion review — fix-picktier-blocker-council-evidence

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

- diff: `diff.patch` — the review scope (branch head 4da97c5804f8eaf3c5f333f31e471ecc27d89356, review
  artefacts excluded), scope hash `0920789bab9af8a096b9f4a67209f512dd8df4644d003adea1102477e9eeaa31`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-d-top-band-model-economy.md
- src/scripts/ai_council/clients.ts

## Output format (contract §2.2)

Fill the findings table in `fix-picktier-blocker-council-evidence.findings.md`:

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
**Honest-null:** 0 findings, scope 0920789bab9af8a096b9f4a67209f512dd8df4644d003adea1102477e9eeaa31, reviewed <YYYY-MM-DD>
```
