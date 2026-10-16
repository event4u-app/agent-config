# R2 completion review — tool-results-repeat-share-2026-10-17

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

- diff: `diff.patch` — the review scope (branch head 5f5ed2264e4c9e7d879a7dcf8493a609ec3b4c1e, review
  artefacts excluded), scope hash `f0fc34d7617e65f4c41ed034c1d4ebeba4124b5f6e201b6cbfe5de5d37b6da2c`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-tool-results-that-leave-a-handle.md
- src/scripts/_lib/cc_transcript.ts
- src/scripts/report_reducible_classes.ts
- tests/scripts/cc_transcript.test.ts
- tests/scripts/report_reducible_classes.test.ts

## Output format (contract §2.2)

Fill the findings table in `tool-results-repeat-share-2026-10-17.findings.md`:

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
**Honest-null:** 0 findings, scope f0fc34d7617e65f4c41ed034c1d4ebeba4124b5f6e201b6cbfe5de5d37b6da2c, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
