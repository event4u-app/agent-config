# R2 completion review — drain-ranker-that-routes-round6

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

- diff: `diff.patch` — the review scope (branch head b696d851fa2b10d4bdb1504d1364053890994e72, review
  artefacts excluded), scope hash `91df14111c7ef7d9a2712d9b1753a37cea78ac71f5df80fd0325a46ad6f8f768`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/skill-ranker-confusion-2026-10-01.md
- agents/roadmaps/archive/road-to-a-ranker-that-routes.md
- agents/roadmaps/road-to-a-ranker-that-routes.md
- src/scripts/_lib/fnv.ts
- src/scripts/measure_skill_ranker_baseline.ts
- src/scripts/report_label_agreement.ts
- src/scripts/report_skill_ranker_confusion.ts
- src/scripts/rule_trigger_eval.ts
- src/scripts/skill_tools/score_skill_relevance.ts
- src/scripts/sweep_skill_ranker_signals.ts
- src/shared/skillRanking.ts
- tests/eval/routing-matrix/second-seat-2026-10-01.json
- tests/scripts/measure_skill_ranker_baseline.test.ts
- tests/scripts/score_skill_relevance.test.ts
- tests/scripts/skill_ranker_reports.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-ranker-that-routes-round6.findings.md`:

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
**Honest-null:** 0 findings, scope 91df14111c7ef7d9a2712d9b1753a37cea78ac71f5df80fd0325a46ad6f8f768, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
