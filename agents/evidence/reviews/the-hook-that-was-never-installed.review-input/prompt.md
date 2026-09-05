# R2 completion review — the-hook-that-was-never-installed

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

- diff: `diff.patch` — the review scope (branch head 500da8b781ee8af1a5c44946123964d8c0c94440, review
  artefacts excluded), scope hash `826f4ce189d4b03a4f002ece7862caf7ef5a38a41c573f2d3fe69a963cfd5ed5`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/archive/road-to-the-hook-that-was-never-installed.md
- agents/roadmaps/road-to-the-hook-that-was-never-installed.md
- dist/agent-src/skills/git-workflow/references/push-closes-its-loop.md
- docs/development.md
- src/scripts/check_installed_hooks_fresh.ts
- src/scripts/install-hooks.sh
- src/skills/git-workflow/references/push-closes-its-loop.md
- tests/scripts/check_installed_hooks_fresh.test.ts

## Output format (contract §2.2)

Fill the findings table in `the-hook-that-was-never-installed.findings.md`:

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
**Honest-null:** 0 findings, scope 826f4ce189d4b03a4f002ece7862caf7ef5a38a41c573f2d3fe69a963cfd5ed5, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
