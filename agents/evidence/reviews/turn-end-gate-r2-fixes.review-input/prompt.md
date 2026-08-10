# R2 completion review — turn-end-gate-r2-fixes

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

- diff: `diff.patch` — the review scope (branch head 67abbb63028ab79fa6d04083523fbb6ffb9033c3, review
  artefacts excluded), scope hash `c3c9a08e481b371aaa65b068dd6049fbca8b28e5c78f8d90af428ddb43f0e870`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/roadmaps/archive/road-to-conformance-round5.md
- dist/install/install.mjs
- src/scripts/hooks/turn_end_gate_hook.ts
- src/scripts/language_mirror_hook.ts
- src/scripts/measure_turn_end_gate.ts
- src/server/schemas/settings.ts
- tests/scripts/language_mirror_hook.test.ts
- tests/scripts/turn_end_gate_hook.test.ts

## Output format (contract §2.2)

Fill the findings table in `turn-end-gate-r2-fixes.findings.md`:

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
**Honest-null:** 0 findings, scope c3c9a08e481b371aaa65b068dd6049fbca8b28e5c78f8d90af428ddb43f0e870, reviewed <YYYY-MM-DD>
```
