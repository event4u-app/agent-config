# R2 completion review — fix-release-shape-allows-its-own-census

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

- diff: `diff.patch` — the review scope (branch head 629e205cdc9aefa730de346eec622c79213f0061, review
  artefacts excluded), scope hash `7a6dc64900f1b783127635b1514d4b08ba98f3a925770e698c1e14d631dc0c18`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- .github/workflows/smoke-public-install.yml
- .github/workflows/tests.yml
- docs/contracts/release-pr-gating.md
- src/scripts/check_release_pr_shape.ts
- src/scripts/report_evidence_temperature.ts
- tests/scripts/check_release_pr_shape.test.ts
- tests/scripts/report_evidence_temperature.test.ts

## Output format (contract §2.2)

Fill the findings table in `fix-release-shape-allows-its-own-census.findings.md`:

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
**Honest-null:** 0 findings, scope 7a6dc64900f1b783127635b1514d4b08ba98f3a925770e698c1e14d631dc0c18, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
