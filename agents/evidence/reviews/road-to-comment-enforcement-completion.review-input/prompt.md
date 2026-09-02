# R2 completion review — road-to-comment-enforcement-completion

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

- diff: `diff.patch` — the review scope (branch head 0d5e0ec85054ee052154c9dff48b0c53cda1cbc4, review
  artefacts excluded), scope hash `a73eedbc7cfc90c3d9097dee70bf8a5ad0b29a7c52b2a2c75ca44be0096b5c09`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/archive/road-to-comment-enforcement-completion.md
- agents/roadmaps/later/road-to-language-and-tone-enforcer-claim.md
- agents/roadmaps/road-to-comment-enforcement-completion.md
- src/config/gate-coverage.yml
- src/scripts/lint_code_comments.ts
- tests/scripts/lint_code_comments.test.ts

## Output format (contract §2.2)

Fill the findings table in `road-to-comment-enforcement-completion.findings.md`:

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
**Honest-null:** 0 findings, scope a73eedbc7cfc90c3d9097dee70bf8a5ad0b29a7c52b2a2c75ca44be0096b5c09, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
