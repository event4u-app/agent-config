# R2 completion review — gates-a-pr-can-hear

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

- diff: `diff.patch` — the review scope (branch head cdae2c7770367863635359ca61b48068c3b16f49, review
  artefacts excluded), scope hash `d4314ead5c765ad6426ef738e1b4dc986c663f56ec6695f83405114d239c05c3`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- .github/workflows/gate-canary.yml
- agents/evidence/analysis/gates-a-pr-can-hear-2026-10.md
- agents/evidence/analysis/workflow-security-net-degraded-decision.md
- agents/evidence/ratifications/drain-road-to-gates-a-pull-request-can-hear-20261007.md
- agents/reports/README.md
- agents/roadmaps/road-to-gates-a-pull-request-can-hear.md
- docs/contracts/adversarial-review-protocol.md
- docs/contracts/branch-protection-policy.md
- package-lock.json
- src/config/gate-coverage.yml
- src/scripts/audit_user_type_axis.ts
- src/scripts/check_gate_coverage.ts
- src/scripts/lint_pack_boundaries.ts
- src/scripts/lint_workflow_security.ts
- src/scripts/print_required_checks.ts
- src/scripts/report_required_checks_drift.ts
- taskfiles/ci-fast.yml
- tests/scripts/audit_user_type_axis_no_write.test.ts
- tests/scripts/print_required_checks.test.ts
- tests/scripts/report_required_checks_drift.test.ts
- tests/scripts/workflow_security_argv_control.test.ts

## Output format (contract §2.2)

Fill the findings table in `gates-a-pr-can-hear.findings.md`:

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
**Honest-null:** 0 findings, scope d4314ead5c765ad6426ef738e1b4dc986c663f56ec6695f83405114d239c05c3, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
