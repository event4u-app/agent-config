# R2 completion review — fix-module-reach-r2-findings-20261006

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

- diff: `diff.patch` — the review scope (branch head ddc0bdcf10f6803164aa240bddd310f85487d9e1, review
  artefacts excluded), scope hash `b4439b830b61dcdbe7710598db8bf6f194189ce576f55ad4f59d57c90a7c28bf`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- src/scripts/_lib/module_reach.ts
- src/scripts/report_module_reach.ts
- tests/scripts/report_module_reach.test.ts

## Output format (contract §2.2)

Fill the findings table in `fix-module-reach-r2-findings-20261006.findings.md`:

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
**Honest-null:** 0 findings, scope b4439b830b61dcdbe7710598db8bf6f194189ce576f55ad4f59d57c90a7c28bf, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
