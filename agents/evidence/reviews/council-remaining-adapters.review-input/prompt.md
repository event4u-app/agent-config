# R2 completion review — council-remaining-adapters

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

- diff: `diff.patch` — the review scope (branch head 9faee19e22fcf51cd21c04b7b12bd0a4da7bfb4e, review
  artefacts excluded), scope hash `34b8f345d0652de96b48de49b2b3793ee157a7f6721d56688e0b70e9e60b3ef4`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- dist/agent-src/skills/ai-council/SKILL.md
- src/scripts/ai_council/clients.ts
- src/skills/ai-council/SKILL.md
- tests/scripts/ai_council/clients.test.ts

## Output format (contract §2.2)

Fill the findings table in `council-remaining-adapters.findings.md`:

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
**Honest-null:** 0 findings, scope 34b8f345d0652de96b48de49b2b3793ee157a7f6721d56688e0b70e9e60b3ef4, reviewed <YYYY-MM-DD>
```
