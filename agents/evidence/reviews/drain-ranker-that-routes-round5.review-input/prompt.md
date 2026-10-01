# R2 completion review — drain-ranker-that-routes-round5

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

- diff: `diff.patch` — the review scope (branch head c33311014ad5dd33224a4551e873b899f4294bcc, review
  artefacts excluded), scope hash `0e556b7d0fb29db305a5ff4d8d78830e5f6d4ef6bd08e625afaef4e2b1dc1f62`
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

Fill the findings table in `drain-ranker-that-routes-round5.findings.md`:

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
**Honest-null:** 0 findings, scope 0e556b7d0fb29db305a5ff4d8d78830e5f6d4ef6bd08e625afaef4e2b1dc1f62, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
