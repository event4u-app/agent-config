# R2 completion review — carrier-layer-convergence

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

- diff: `diff.patch` — the review scope (branch head 195523465db8fabb84be3f4ad27f8293cf5e4ac5, review
  artefacts excluded), scope hash `d4a4c73175c2a07c95f189385bd5f46bd96b49093d8d5e6edeac510739cceee9`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/carrier-layer-divergence-classification.md
- agents/evidence/analysis/loaded-rule-token-distribution.md
- agents/roadmaps-progress.md
- agents/roadmaps/later/road-to-conformance-round6.md
- agents/roadmaps/road-to-carrier-layer-convergence.md
- src/scripts/_lib/carrier_divergence.ts
- src/scripts/report_carrier_divergence.ts
- src/scripts/report_conformance_funnel.ts
- tests/scripts/report_carrier_divergence.test.ts
- tests/scripts/report_conformance_funnel.test.ts

## Output format (contract §2.2)

Fill the findings table in `carrier-layer-convergence.findings.md`:

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
**Honest-null:** 0 findings, scope d4a4c73175c2a07c95f189385bd5f46bd96b49093d8d5e6edeac510739cceee9, reviewed <YYYY-MM-DD>
```
