# R2 completion review — feat-estate-drawdown-sheet-and-ratchet

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

- diff: `diff.patch` — the review scope (branch head e184eb9e2aa56acdce4613564dad62e353529375, review
  artefacts excluded), scope hash `26c719985e71995f2230b16d0ce70f7da6f7df197a11723fb950fdbe8c50b2ad`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- Taskfile.yml
- agents/decisions/consolidated-decision-sheet.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-carrier-layer-convergence.md
- agents/roadmaps/road-to-cost-parity-1-rule-payload-diet.md
- agents/roadmaps/road-to-council-blind-review.md
- agents/roadmaps/road-to-estate-drawdown.md
- agents/roadmaps/road-to-orchestration-scope-decision.md
- agents/roadmaps/road-to-scale-history-bench-run.md
- agents/roadmaps/road-to-skill-description-measurement.md
- dist/agent-src/scripts/roadmap_gates.ts
- src/agent-src/scripts/roadmap_gates.ts
- src/config/estate-count-budget.json
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json
- src/scripts/_dispatch.bash
- src/scripts/check_estate_count.ts
- src/scripts/dispatch_r2_reviewer.ts
- taskfiles/ci-fast.yml
- tests/scripts/check_estate_count.test.ts
- tests/scripts/dispatch_r2_reviewer.test.ts
- tests/scripts/roadmap_gates.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-estate-drawdown-sheet-and-ratchet.findings.md`:

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
**Honest-null:** 0 findings, scope 26c719985e71995f2230b16d0ce70f7da6f7df197a11723fb950fdbe8c50b2ad, reviewed <YYYY-MM-DD>
```
