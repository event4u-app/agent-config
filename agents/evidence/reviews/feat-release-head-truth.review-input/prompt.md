# R2 completion review — feat-release-head-truth

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

- diff: `diff.patch` — the review scope (branch head 6f5d0f4aaeb85732c28ac29a70a260b852e56baf, review
  artefacts excluded), scope hash `5056f22678a072e3d0fed7edaeb3fe10cab8c8079dc974b94f41f2368666a944`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/release-head-derivation-recall.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-c-release-head-truth.md
- docs/contracts/CHANGELOG-conventions.md
- src/scripts/_lib/release_highlights.ts
- tests/scripts/check_release_highlights.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-release-head-truth.findings.md`:

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
**Honest-null:** 0 findings, scope 5056f22678a072e3d0fed7edaeb3fe10cab8c8079dc974b94f41f2368666a944, reviewed <YYYY-MM-DD>
```
