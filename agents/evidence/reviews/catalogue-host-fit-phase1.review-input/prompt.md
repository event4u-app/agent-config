# R2 completion review — catalogue-host-fit-phase1

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

- diff: `diff.patch` — the review scope (branch head c69336cb6da996320295d61c0658d06791b75cc6, review
  artefacts excluded), scope hash `9bd9a934a1a5f883a76ab6a0de050479241fe355804e8e2d80553479059d92f3`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-catalogue-host-fit.md
- agents/roadmaps/road-to-frontend-skill-application.md
- src/scripts/_lib/skill_catalogue.ts
- src/scripts/capture_skill_catalogue.ts
- tests/scripts/catalogue_capture.test.ts

## Output format (contract §2.2)

Fill the findings table in `catalogue-host-fit-phase1.findings.md`:

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
**Honest-null:** 0 findings, scope 9bd9a934a1a5f883a76ab6a0de050479241fe355804e8e2d80553479059d92f3, reviewed <YYYY-MM-DD>
```
