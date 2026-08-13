# R2 completion review — feat-close-gate-reds-blockers

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

- diff: `diff.patch` — the review scope (branch head b271d078b70d3c177571fc152cc00315b5780aba, review
  artefacts excluded), scope hash `faf1525aa307bd3db5bd628edeb27bc024a8459a7ec9bb6a76af8d76a49449e3`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-local-only-gate-reds.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b.md
- docs/contracts/ci-green-floor.md
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json

## Output format (contract §2.2)

Fill the findings table in `feat-close-gate-reds-blockers.findings.md`:

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
**Honest-null:** 0 findings, scope faf1525aa307bd3db5bd628edeb27bc024a8459a7ec9bb6a76af8d76a49449e3, reviewed <YYYY-MM-DD>
```
