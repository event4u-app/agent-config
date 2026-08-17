# R2 completion review — evidence-artifact-typing

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

- diff: `diff.patch` — the review scope (branch head e16b1d1fbae2f221ffe67bf567b726eec5287424, review
  artefacts excluded), scope hash `7b5daccfba24e5abc0483460c8e75a1023b79c67b7cfff11ac65bb85124e1c8f`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- Taskfile.yml
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-release-review-p0.md
- docs/contracts/evidence-artifact-types.md
- src/config/gate-coverage.yml
- src/scripts/dispatch_r2_reviewer.ts
- src/scripts/lint_evidence_artifacts.ts
- taskfiles/ci-fast.yml
- tests/scripts/lint_evidence_artifacts.test.ts

## Output format (contract §2.2)

Fill the findings table in `evidence-artifact-typing.findings.md`:

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
**Honest-null:** 0 findings, scope 7b5daccfba24e5abc0483460c8e75a1023b79c67b7cfff11ac65bb85124e1c8f, reviewed <YYYY-MM-DD>
```
