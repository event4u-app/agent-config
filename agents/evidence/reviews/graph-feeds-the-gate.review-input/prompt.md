# R2 completion review — graph-feeds-the-gate

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

- diff: `diff.patch` — the review scope (branch head feb71ffa2ccd05aaa4333b3a01ad3b4193f42725, review
  artefacts excluded), scope hash `74329b2ad6f9fd081b88e3d376e2263f00fbc7582c734ac65d37325114f18ee1`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/graph-feeder-recall-2026-Q4.md
- agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
- src/scripts/_lib/graph_feeder_record.ts
- src/scripts/hooks/turn_end_gate_hook.ts
- tests/scripts/graph_feeder_record.test.ts

## Output format (contract §2.2)

Fill the findings table in `graph-feeds-the-gate.findings.md`:

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
**Honest-null:** 0 findings, scope 74329b2ad6f9fd081b88e3d376e2263f00fbc7582c734ac65d37325114f18ee1, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
