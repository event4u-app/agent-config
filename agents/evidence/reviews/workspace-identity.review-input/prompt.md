# R2 completion review — workspace-identity

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

- diff: `diff.patch` — the review scope (branch head 1141051719d9e43fa102394954100f4fdd7afbd9, review
  artefacts excluded), scope hash `8aa31c7517ce2b4412950b16cb7ffe04335d7fc082c7617d3241b56aef93e1e2`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/workspace-identity-census.md
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-c-workspace-identity.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-c-workspace-identity.md
- src/cli/registry.ts
- src/config/evaluator-budgets.json
- src/scripts/_dispatch.bash
- src/scripts/_lib/git_common_dir.ts
- src/scripts/check_branch_freshness.ts
- src/scripts/check_release_published.ts
- src/scripts/check_release_trunk_sync.ts
- src/scripts/evidence_report.ts
- src/scripts/lint_plan_risk_register.ts
- src/scripts/migration_status.ts
- src/scripts/workspace_doctor.ts
- tests/scripts/workspace_doctor.test.ts
- tests/scripts/workspace_identity.test.ts

## Output format (contract §2.2)

Fill the findings table in `workspace-identity.findings.md`:

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
**Honest-null:** 0 findings, scope 8aa31c7517ce2b4412950b16cb7ffe04335d7fc082c7617d3241b56aef93e1e2, reviewed <YYYY-MM-DD>
```
