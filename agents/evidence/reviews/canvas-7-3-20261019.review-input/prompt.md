# R2 completion review — canvas-7-3-20261019

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

- diff: `diff.patch` — the review scope (branch head 66158b63a61dcc7d3ca2e9f6bd42ec8e23c3f150, review
  artefacts excluded), scope hash `838d5045e7e43f747f630de335b2e455692507214be4cbd19b99f6d170d50b64`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/delivery-set-measurement-2026-08-31.json
- agents/evidence/analysis/routing-body-signal-verdict.json
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/roadmaps/road-to-a-canvas-the-code-owns.md
- dist/agent-src/skills/playwright-testing/SKILL.md
- dist/agent-src/skills/playwright-testing/evals/triggers.json
- src/config/routing-coverage-seed.json
- src/config/skill-body-budget.json
- src/scripts/trigger_eval_grandfather.json
- src/skills/playwright-testing/SKILL.md
- src/skills/playwright-testing/evals/triggers.json
- tests/scripts/routing_signal_measurement.test.ts

## Output format (contract §2.2)

Fill the findings table in `canvas-7-3-20261019.findings.md`:

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
**Honest-null:** 0 findings, scope 838d5045e7e43f747f630de335b2e455692507214be4cbd19b99f6d170d50b64, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
