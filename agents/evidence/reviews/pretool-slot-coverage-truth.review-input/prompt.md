# R2 completion review — pretool-slot-coverage-truth

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

- diff: `diff.patch` — the review scope (branch head d36c665b5b5d6918d0200710d3df489b10084782, review
  artefacts excluded), scope hash `fbe370ef18596e28228731a0fe9b4a6acc99485acda25299cfb1e821605528cc`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- dist/agent-src/rules/autonomous-execution.md
- dist/agent-src/rules/evaluator-independence.md
- dist/agent-src/rules/git-history-discipline.md
- docs/contracts/hook-architecture-v1.md
- src/rules/autonomous-execution.md
- src/rules/evaluator-independence.md
- src/rules/git-history-discipline.md
- src/scripts/hooks/ui_route_nudge_hook.ts

## Output format (contract §2.2)

Fill the findings table in `pretool-slot-coverage-truth.findings.md`:

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
**Honest-null:** 0 findings, scope fbe370ef18596e28228731a0fe9b4a6acc99485acda25299cfb1e821605528cc, reviewed <YYYY-MM-DD>
```
