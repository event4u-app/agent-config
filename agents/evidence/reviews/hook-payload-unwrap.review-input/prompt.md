# R2 completion review — hook-payload-unwrap

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

- diff: `diff.patch` — the review scope (branch head 15785e5d56deb2e352ff8dcfe93cc9632269591d, review
  artefacts excluded), scope hash `71146161e09b6ee603e5c0ae6489a136e2c698865a7c24adffb17a19758666ee`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-per-turn-hook-economy.md
- src/scripts/hooks/ship_diff_volume_hook.ts
- tests/hooks/ship_diff_volume.test.ts

## Output format (contract §2.2)

Fill the findings table in `hook-payload-unwrap.findings.md`:

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
**Honest-null:** 0 findings, scope 71146161e09b6ee603e5c0ae6489a136e2c698865a7c24adffb17a19758666ee, reviewed <YYYY-MM-DD>
```
