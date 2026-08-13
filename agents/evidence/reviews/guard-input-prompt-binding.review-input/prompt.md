# R2 completion review — guard-input-prompt-binding

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

- diff: `diff.patch` — the review scope (branch head 6ea08095c11b1e2ee0309ecd3aa5e350b751a831, review
  artefacts excluded), scope hash `364a1cad1a1241da90e5597ac3f34ac742963e21d508e2f521b1436381b831f9`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- Taskfile.yml
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-structured-guard-input.md
- agents/roadmaps/road-to-structured-guard-input.md
- docs/contracts/plan-review-gates.md
- src/config/gate-coverage.yml
- src/config/review-prompt-binding-baseline.json
- src/scripts/check_review_prompt_binding.ts
- src/scripts/check_suppression_hygiene.ts
- src/scripts/dispatch_r2_reviewer.ts
- taskfiles/ci-fast.yml
- tests/scripts/check_review_prompt_binding.test.ts

## Output format (contract §2.2)

Fill the findings table in `guard-input-prompt-binding.findings.md`:

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
**Honest-null:** 0 findings, scope 364a1cad1a1241da90e5597ac3f34ac742963e21d508e2f521b1436381b831f9, reviewed <YYYY-MM-DD>
```
