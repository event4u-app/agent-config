# R2 completion review — run-continuation-provenance

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

- diff: `diff.patch` — the review scope (branch head d8a4cdcaaffc5be7fa095f69963de226d68a4925, review
  artefacts excluded), scope hash `3fbe0a1736aaa05d5e35ff433b98faa8ea052fa9cc6c2a1d2f40f95fbb1ec655`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-run-continuation-observation.md
- dist/agent-src/commands/roadmap/process-full.md
- dist/agent-src/contexts/execution/roadmap-process-loop.md
- docs/decisions/ADR-235-process-full-blocked-terminal-outcome.md
- docs/decisions/INDEX.md
- src/agent-src/contexts/execution/roadmap-process-loop.md
- src/domains/product-basic/roadmap/process-full/command.md
- src/scripts/hooks/run_continuation_hook.ts
- src/scripts/session_register_hook.ts
- tests/hooks/run_continuation_dispatch.test.ts
- tests/scripts/hooks/run_continuation.test.ts
- tests/scripts/session_register.test.ts

## Output format (contract §2.2)

Fill the findings table in `run-continuation-provenance.findings.md`:

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
**Honest-null:** 0 findings, scope 3fbe0a1736aaa05d5e35ff433b98faa8ea052fa9cc6c2a1d2f40f95fbb1ec655, reviewed <YYYY-MM-DD>
```
