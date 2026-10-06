# R2 completion review — drain-road-to-a-graph-that-feeds-the-gate-20261006c

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

- diff: `diff.patch` — the review scope (branch head 60b92e5f6e8d344d477f2be2fbe5396e919e0b05, review
  artefacts excluded), scope hash `936d3f8219f096652f48fef44446304c46134e51a01c9c62c0a8bb312e4f733c`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/graph-feeder-latency-2026-Q4.md
- agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
- package-lock.json
- package.json
- src/scripts/_lib/graph_feeder_record.ts
- src/scripts/bench_graph_feeder_latency.ts
- tests/scripts/bench_graph_feeder_latency.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-road-to-a-graph-that-feeds-the-gate-20261006c.findings.md`:

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
**Honest-null:** 0 findings, scope 936d3f8219f096652f48fef44446304c46134e51a01c9c62c0a8bb312e4f733c, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
