# R2 completion review — pr-target-base-freshness

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

- diff: `diff.patch` — the review scope (branch head 4e8988172a773be43b8a9b3d93d3676f76fc5adf, review
  artefacts excluded), scope hash `3a10dca09001b706d8de57c0b4df42104affe91a4216febc1fdfb3b48711656a`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- dist/agent-src/commands/pr/create.md
- dist/agent-src/skills/git-workflow/SKILL.md
- src/domains/git/pr/create/command.md
- src/scripts/check_branch_freshness.ts
- src/skills/git-workflow/SKILL.md
- taskfiles/ci-fast.yml
- tests/scripts/check_branch_freshness.test.ts

## Output format (contract §2.2)

Fill the findings table in `pr-target-base-freshness.findings.md`:

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
**Honest-null:** 0 findings, scope 3a10dca09001b706d8de57c0b4df42104affe91a4216febc1fdfb3b48711656a, reviewed <YYYY-MM-DD>
```
