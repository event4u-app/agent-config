# R2 completion review — solution-minimalism-t4-t5-scorers

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

- diff: `diff.patch` — the review scope (branch head 06b8e2d9e68444a7f66d1218664dcaa30a4240b0, review
  artefacts excluded), scope hash `49d5bf659a2e13cfc11f4f5bcdc8b493a3e826bb0940fa8755bf460f850a05cb`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-solution-minimalism.md
- internal/bench/REPRODUCE-ab-v2.md
- internal/bench/ab-v2-phase3-PREREG.md
- internal/bench/ab/adversarial-v2/_probe.mjs
- internal/bench/ab/adversarial-v2/safeF-guard-01.mjs
- internal/bench/ab/adversarial-v2/safeF-guard-02.mjs
- internal/bench/ab/adversarial-v2/safeF-guard-03.mjs
- internal/bench/ab/fixtures-v2/safeF-guard-01/content/intro.md
- internal/bench/ab/fixtures-v2/safeF-guard-01/package.json
- internal/bench/ab/fixtures-v2/safeF-guard-01/src/docs.mjs
- internal/bench/ab/fixtures-v2/safeF-guard-01/tests/solve.check.mjs
- internal/bench/ab/fixtures-v2/safeF-guard-02/package.json
- internal/bench/ab/fixtures-v2/safeF-guard-02/src/query.mjs
- internal/bench/ab/fixtures-v2/safeF-guard-02/tests/solve.check.mjs
- internal/bench/ab/fixtures-v2/safeF-guard-03/package.json
- internal/bench/ab/fixtures-v2/safeF-guard-03/src/invoices.mjs
- internal/bench/ab/fixtures-v2/safeF-guard-03/tests/solve.check.mjs
- internal/bench/corpora/SCHEMA-v2.md
- internal/bench/corpora/ab-trackb-v2.yaml
- src/scripts/_lib/bench_ab_safety_tier.ts
- src/scripts/_lib/bench_ab_search_adherence.ts
- src/scripts/bench_ab_v2_run.ts
- src/scripts/bench_ab_v2_safety.ts
- src/scripts/bench_ab_v2_search.ts
- src/scripts/bench_ab_v2_stats.ts
- tests/scripts/_lib_bench_ab_safety_tier.test.ts
- tests/scripts/_lib_bench_ab_search_adherence.test.ts
- tests/scripts/bench_ab_v2_safety.test.ts
- tests/scripts/bench_ab_v2_search.test.ts
- tests/scripts/bench_ab_v2_stats.test.ts

## Output format (contract §2.2)

Fill the findings table in `solution-minimalism-t4-t5-scorers.findings.md`:

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
**Honest-null:** 0 findings, scope 49d5bf659a2e13cfc11f4f5bcdc8b493a3e826bb0940fa8755bf460f850a05cb, reviewed <YYYY-MM-DD>
```
