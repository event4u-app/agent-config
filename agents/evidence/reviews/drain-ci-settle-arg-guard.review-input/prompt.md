# R2 completion review — drain-ci-settle-arg-guard

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

- diff: `diff.patch` — the review scope (branch head 14815e5c2e3f2d4a36e052693e51fa68d2af8096, review
  artefacts excluded), scope hash `70f2302fcf7ddd1f4bcd1638162ef0d532dda4ba15b07f8aa9f2824a4f4cd421`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- dist/agent-src/commands/roadmap/process-full.md
- src/domains/meta/pack.yaml
- src/domains/product-basic/roadmap/process-full/command.md
- src/scripts/ci_settle.ts
- tests/scripts/ci_settle.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-ci-settle-arg-guard.findings.md`:

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
**Honest-null:** 0 findings, scope 70f2302fcf7ddd1f4bcd1638162ef0d532dda4ba15b07f8aa9f2824a4f4cd421, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
