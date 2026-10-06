# R2 completion review — drain-modules-that-something-calls-20261006

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

- diff: `diff.patch` — the review scope (branch head ec828db534f8767eee7a06279472b57b3cc482bf, review
  artefacts excluded), scope hash `762a859b610b42d1caf77e06bc256a2f722978de2c6621de7f9dd86e1f7c454f`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/module-reach-2026-10.md
- agents/roadmaps/archive/road-to-modules-that-something-calls.md
- agents/roadmaps/road-to-adversarial-verification-and-long-runs.md
- agents/roadmaps/road-to-modules-that-something-calls.md
- agents/roadmaps/stubs/road-to-tdd-phase-guard.md
- docs/CLAIMS.md
- docs/proof.md
- src/config/assurance-capability-registry.json
- src/config/continuity-surface.json
- src/scripts/_lib/config_chain.ts
- src/scripts/_lib/conformance_report.ts
- src/scripts/_lib/eval_discrimination.ts
- src/scripts/_lib/evaluator_promotion.ts
- src/scripts/_lib/file_slicer.ts
- src/scripts/_lib/legacy_boundary_map.ts
- src/scripts/_lib/minimality_tiebreak.ts
- src/scripts/_lib/module_reach.ts
- src/scripts/_lib/overbuild_lens_contract.ts
- src/scripts/_lib/role_split.ts
- src/scripts/_lib/test_red_state.ts
- src/scripts/check_gate_reachability.ts
- src/scripts/generate_host_cost_table.ts
- src/scripts/lint_evidence_artifacts.ts
- src/scripts/report_module_reach.ts
- tests/scripts/_lib_eval_discrimination.test.ts
- tests/scripts/check_gate_reachability_module_counts.test.ts
- tests/scripts/config_chain.test.ts
- tests/scripts/config_chain.ts
- tests/scripts/conformance_report.test.ts
- tests/scripts/conformance_report.ts
- tests/scripts/eval_discrimination.ts
- tests/scripts/evaluation_vector.test.ts
- tests/scripts/evaluator_promotion.test.ts
- tests/scripts/evaluator_promotion.ts
- tests/scripts/file_slicer.test.ts
- tests/scripts/file_slicer.ts
- tests/scripts/generate_host_cost_table.test.ts
- tests/scripts/legacy_boundary_map.test.ts
- tests/scripts/legacy_boundary_map.ts
- tests/scripts/lint_evidence_artifacts.test.ts
- tests/scripts/minimality_tiebreak.test.ts
- tests/scripts/minimality_tiebreak.ts
- tests/scripts/module_reach_fourth_group_empty.test.ts
- tests/scripts/overbuild_lens_contract.test.ts
- tests/scripts/overbuild_lens_contract.ts
- tests/scripts/report_module_reach.test.ts
- tests/scripts/role_split.test.ts
- tests/scripts/role_split.ts
- tests/scripts/tolerance_shadow.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-modules-that-something-calls-20261006.findings.md`:

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
**Honest-null:** 0 findings, scope 762a859b610b42d1caf77e06bc256a2f722978de2c6621de7f9dd86e1f7c454f, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
