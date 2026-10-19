# R2 completion review — analysis-family-drain-20261019

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

- diff: `diff.patch` — the review scope (branch head d87cd8e0402cf911c406a00983e2b797c61745fc, review
  artefacts excluded), scope hash `d9842c0eece069df6276bbf0aa67a2998f2337ca392ad5ea6ed6fe26128e7ebd`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-an-analysis-family-that-deepens-itself.md
- dist/agent-src/commands/analyze/inbox.md
- dist/agent-src/commands/analyze/repo.md
- dist/agent-src/contexts/execution/analysis-loop.md
- src/agent-src/contexts/execution/analysis-loop.md
- src/domains/analysis-workbench/analyze/inbox/command.md
- src/domains/analysis-workbench/analyze/repo/command.md
- src/domains/meta/pack.yaml
- tests/scripts/analysis_family_aliases.test.ts
- tests/scripts/analysis_gate_surfacing.test.ts
- tests/scripts/analysis_scope_line_doors.test.ts
- tests/scripts/analyze_inbox_limits.test.ts

## Output format (contract §2.2)

Fill the findings table in `analysis-family-drain-20261019.findings.md`:

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
**Honest-null:** 0 findings, scope d9842c0eece069df6276bbf0aa67a2998f2337ca392ad5ea6ed6fe26128e7ebd, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
