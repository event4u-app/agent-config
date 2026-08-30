# R2 completion review — drain-supervised-telemetry

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

- diff: `diff.patch` — the review scope (branch head 3a4815f6a926ae80d0c1611011f82039be87ab85, review
  artefacts excluded), scope hash `db7d66ecded2127418a54101764ddf3f675179539b61427c01cf9f8b42cc4ca2`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/tests.yml
- .gitignore
- agents/roadmaps/archive/road-to-source-silence.md
- agents/roadmaps/later/road-to-supervised-telemetry-collector.md
- agents/roadmaps/road-to-supervised-telemetry-collector.md
- docs/contracts/ci-cost-budget.md
- docs/contracts/collector-operations.md
- src/config/ci-local-parity.yml
- src/scripts/_lib/capture_rate.ts
- src/scripts/_lib/collector_denominator.ts
- src/scripts/_lib/collector_supervision.ts
- src/scripts/check_static_parity.ts
- src/scripts/collector_daemon.ts
- src/scripts/hooks/dispatch_hook.ts
- src/scripts/run_lifecycle_suite.ts
- tests/_lib/collector-absent-stub.ts
- tests/scripts/capture_rate.test.ts
- tests/scripts/check_static_parity.test.ts
- tests/scripts/collector_daemon.test.ts
- tests/scripts/collector_lifecycle.test.ts
- tests/scripts/collector_store.test.ts
- tests/scripts/collector_supervision.test.ts
- tests/scripts/collector_vocabulary_parity.test.ts
- vitest.config.ts

## Output format (contract §2.2)

Fill the findings table in `drain-supervised-telemetry.findings.md`:

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
**Honest-null:** 0 findings, scope db7d66ecded2127418a54101764ddf3f675179539b61427c01cf9f8b42cc4ca2, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
