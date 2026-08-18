# R2 completion review — feat-hook-payload-optin

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

- diff: `diff.patch` — the review scope (branch head b59572e6e648ecee4777c7f88a3998180af398a9, review
  artefacts excluded), scope hash `5d23a80020f0ab1ff386c0ad3dc96af11ebdc5c19db2c8086327fbcb9e1cee29`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-per-turn-hook-economy.md
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/dispatch_hook.ts
- src/scripts/hooks/payload_stub.ts
- src/scripts/hooks/tool_result_bytes_hook.ts
- src/scripts/lint_hook_manifest.ts
- tests/hooks/fixtures/concern_report_body.ts
- tests/scripts/hooks/payload_optin.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-hook-payload-optin.findings.md`:

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
**Honest-null:** 0 findings, scope 5d23a80020f0ab1ff386c0ad3dc96af11ebdc5c19db2c8086327fbcb9e1cee29, reviewed <YYYY-MM-DD>
```
