# R2 completion review — drain-delivery-for-every-host

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

- diff: `diff.patch` — the review scope (branch head 0311da7c4d9d547be599eb90c1f86961878504de, review
  artefacts excluded), scope hash `8aed75f4b813b39e98b662af6b2ab59c5c69d07ce29707e3991f6490b71feba7`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/evidence/analysis/standing-payload-by-host-2026-09.md
- agents/roadmaps/road-to-delivery-for-every-host.md
- agents/roadmaps/road-to-delivery-on-hook-hosts.md
- docs/CLAIMS.md
- docs/contracts/settings-classes.md
- docs/decisions/ADR-265-delivery-default-for-claude-code.md
- docs/decisions/INDEX.md
- docs/proof.md
- src/config/agent-settings.template.yml
- src/config/hook-token-budget.json
- src/config/routing-coverage-seed.json
- src/scripts/_lib/hook_settings.ts
- src/scripts/_lib/lean_projection_mode.ts
- src/scripts/check_host_tree_parity.ts
- src/scripts/check_rule_projection_integrity.ts
- src/scripts/condense.ts
- src/scripts/hook_manifest.json
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/rule_inject_hook.ts
- src/scripts/project_thin_rules.ts
- src/scripts/report_standing_payload_by_host.ts
- src/scripts/schemas/agent-settings.schema.json
- src/server/schemas/settings.ts
- taskfiles/ci-fast.yml
- tests/eval/routing-matrix/council-availability.yaml
- tests/eval/routing-matrix/evaluator-independence.yaml
- tests/eval/routing-matrix/fix-what-you-see.yaml
- tests/eval/routing-matrix/missing-skill-recovery.yaml
- tests/eval/routing-matrix/playbook-precedence.yaml
- tests/eval/routing-matrix/recurring-criticism.yaml
- tests/eval/routing-matrix/self-repair-loop.yaml
- tests/scripts/_lib/lean_projection_shipped_default.test.ts
- tests/scripts/lean_projection_host_scope.test.ts
- tests/scripts/lean_projection_hosts.test.ts
- tests/scripts/project_thin_rules.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-delivery-for-every-host.findings.md`:

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
**Honest-null:** 0 findings, scope 8aed75f4b813b39e98b662af6b2ab59c5c69d07ce29707e3991f6490b71feba7, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
