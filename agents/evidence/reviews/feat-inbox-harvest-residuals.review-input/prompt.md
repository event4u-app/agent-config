# R2 completion review — feat-inbox-harvest-residuals

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

- diff: `diff.patch` — the review scope (branch head 358c91db0bd44aa0c65c9f8aad000f7e2c98f3ac, review
  artefacts excluded), scope hash `f3844188f0315759d9b5048110c3d76515c69bfdf00e4858c473eeaf413e1a2c`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/rule-backstops.yml
- Taskfile.yml
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-d-scheduled-deprecation.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-d-scheduled-deprecation.md
- agents/roadmaps/road-to-inbox-harvest-residuals.md
- dist/agent-src/skills/design-system-capture/SKILL.md
- dist/agent-src/skills/design-system-capture/references/snapshot-preference-order.md
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json
- src/scripts/check_source_size_budget.ts
- src/skills/design-system-capture/SKILL.md
- src/skills/design-system-capture/references/snapshot-preference-order.md
- taskfiles/ci-fast.yml
- tests/scripts/check_source_size_budget.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-inbox-harvest-residuals.findings.md`:

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
**Honest-null:** 0 findings, scope f3844188f0315759d9b5048110c3d76515c69bfdf00e4858c473eeaf413e1a2c, reviewed <YYYY-MM-DD>
```
