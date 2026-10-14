# R2 completion review — drain-svg-witness-provenance

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

- diff: `diff.patch` — the review scope (branch head 000eaddd97a8cbb19b8048824bc3730393863204, review
  artefacts excluded), scope hash `764d7d5f8866e4cc880e8e9d807c06cc9b6a9fa9330d079207907181123d8afc`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-svg-witness-provenance.md
- src/cli/commands/uiRender.ts
- src/scripts/_lib/asset_render_record.ts
- src/scripts/before_complete_hook.ts
- src/scripts/hooks/svg_obligation.ts
- src/scripts/hooks/turn_end_gate_hook.ts
- tests/scripts/svg_render_record.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-svg-witness-provenance.findings.md`:

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
**Honest-null:** 0 findings, scope 764d7d5f8866e4cc880e8e9d807c06cc9b6a9fa9330d079207907181123d8afc, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
