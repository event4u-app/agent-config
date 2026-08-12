# R2 completion review — council-codex-transport

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

- diff: `diff.patch` — the review scope (branch head cd8e518c115b2b873e2c85fc8aaf1c85edc37f67, review
  artefacts excluded), scope hash `113b7f805b50a4eaa4a9ef0aa483424f02d326b749e672c9831afe38bfe12567`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- dist/agent-src/skills/ai-council/SKILL.md
- src/scripts/ai_council/clients.ts
- src/scripts/council_cli.ts
- src/skills/ai-council/SKILL.md
- tests/scripts/ai_council/clients.test.ts
- tests/scripts/ai_team/team_dispatch.test.ts
- tests/scripts/council_cli.test.ts

## Output format (contract §2.2)

Fill the findings table in `council-codex-transport.findings.md`:

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
**Honest-null:** 0 findings, scope 113b7f805b50a4eaa4a9ef0aa483424f02d326b749e672c9831afe38bfe12567, reviewed <YYYY-MM-DD>
```
