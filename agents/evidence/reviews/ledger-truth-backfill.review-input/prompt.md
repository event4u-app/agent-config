# R2 completion review — ledger-truth-backfill

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

- diff: `diff.patch` — the review scope (branch head daa3d0d0b633d7aba27126b7512aa9f7be520790, review
  artefacts excluded), scope hash `a3520ee952fd24f180d57d399b9af1162fd159d6f53d397355070bd6ceae26cd`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/rate-missing-observed-row.md
- agents/roadmaps-progress.md
- agents/roadmaps/archive/INDEX.md
- agents/roadmaps/archive/index.json
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-ledger-truth.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-ledger-truth.md
- docs/contracts/cost-summary-schema.md
- src/scripts/cost/backfill_rates.mjs
- tests/scripts/cost_backfill_rates.test.ts

## Output format (contract §2.2)

Fill the findings table in `ledger-truth-backfill.findings.md`:

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
**Honest-null:** 0 findings, scope a3520ee952fd24f180d57d399b9af1162fd159d6f53d397355070bd6ceae26cd, reviewed <YYYY-MM-DD>
```
