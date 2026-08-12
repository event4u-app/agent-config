# R2 completion review — feat-parallel-session-collision-hardening

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

- diff: `diff.patch` — the review scope (branch head 60c0df808af87a748643d1fbfe2310a9a08f2c25, review
  artefacts excluded), scope hash `f6cabf7e39d7dec7f03b9fdff2a49bcd14e0c5fc1a26650409ae888ac096d736`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- dist/agent-src/commands/roadmap/next.md
- docs/guides/parallel-sessions.md
- src/cli/registry.ts
- src/domains/product-basic/roadmap/next/command.md
- src/scripts/_dispatch.bash
- src/scripts/_lib/session_register.ts
- src/scripts/session_register_hook.ts
- src/scripts/sessions_cli.ts
- tests/scripts/session_register.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-parallel-session-collision-hardening.findings.md`:

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
**Honest-null:** 0 findings, scope f6cabf7e39d7dec7f03b9fdff2a49bcd14e0c5fc1a26650409ae888ac096d736, reviewed <YYYY-MM-DD>
```
