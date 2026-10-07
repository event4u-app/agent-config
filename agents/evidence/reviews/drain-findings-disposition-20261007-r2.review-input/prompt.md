# R2 completion review — drain-findings-disposition-20261007-r2

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

- diff: `diff.patch` — the review scope (branch head 90b1c153c8ae305508698d7583f40c83f7e45bcc, review
  artefacts excluded), scope hash `da6b73d18365c8292427350a9e8e54d081cc951655432427c8238c9f8059f0c9`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/release-findings/16.3.0.json
- agents/roadmaps/road-to-findings-that-get-a-disposition.md
- src/scripts/check_finding_dispositions.ts
- src/scripts/self_review_gate.test.ts
- src/scripts/self_review_gate.ts
- tests/scripts/check_finding_dispositions.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-findings-disposition-20261007-r2.findings.md`:

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
**Honest-null:** 0 findings, scope da6b73d18365c8292427350a9e8e54d081cc951655432427c8238c9f8059f0c9, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
