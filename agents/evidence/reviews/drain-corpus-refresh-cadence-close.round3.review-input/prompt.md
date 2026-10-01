# R2 completion review — drain-corpus-refresh-cadence-close-round3

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

- diff: `diff.patch` — the review scope (branch head 0ca22704521310bfc5d9ac7926a31485a56e602f, review
  artefacts excluded), scope hash `2fadc2ee3a0fedc977236b7461dbeb93671aa8e14540db78f063c1d4363b868b`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/roadmaps/road-to-corpus-refresh-cadence-shape.md
- dist/agent-src/skills/accessibility-auditor/data/aria-patterns.csv
- dist/agent-src/skills/accessibility-auditor/data/manifest.json
- dist/agent-src/skills/accessibility-auditor/evals/triggers.json
- src/config/routing-coverage-seed.json
- src/scripts/trigger_eval_grandfather.json
- src/skills/accessibility-auditor/data/aria-patterns.csv
- src/skills/accessibility-auditor/data/manifest.json
- src/skills/accessibility-auditor/evals/triggers.json
- tests/scripts/routing_signal_measurement.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-corpus-refresh-cadence-close-round3.findings.md`:

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
**Honest-null:** 0 findings, scope 2fadc2ee3a0fedc977236b7461dbeb93671aa8e14540db78f063c1d4363b868b, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
