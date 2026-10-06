# R2 completion review — drain-spend-bound-where-set

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

- diff: `diff.patch` — the review scope (branch head e926fe7943bebd8c1c40156656fc0f2a533eb51c, review
  artefacts excluded), scope hash `f4c1b51150a064a9ec211718668b5d691b20eb732096906e5a5e103c8fca4a89`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- CHANGELOG.md
- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/evidence/analysis/delivery-set-measurement-2026-08-31.json
- agents/evidence/analysis/routing-body-signal-verdict.json
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/evidence/council/spend-bound-defaults-2026-10.md
- agents/roadmaps/archive/road-to-a-spend-bound-only-where-one-was-set.md
- agents/roadmaps/later/road-to-billing-cliff-detection.md
- agents/roadmaps/road-to-a-spend-bound-only-where-one-was-set.md
- agents/roadmaps/stubs/road-to-gate-preauth-authorization.md
- agents/templates/.ai-council.yml.example
- dist/agent-src/commands/council.md
- dist/agent-src/commands/council/debate.md
- dist/agent-src/commands/council/default.md
- dist/agent-src/commands/roadmap/process-full.md
- dist/agent-src/contexts/execution/roadmap-execution-contract.md
- dist/agent-src/contexts/execution/roadmap-process-loop.md
- dist/agent-src/scripts/gate_budget.ts
- dist/agent-src/scripts/gate_execute.ts
- dist/agent-src/skills/ai-council/SKILL.md
- dist/agent-src/skills/ai-council/evals/triggers.json
- dist/agent-src/skills/ai-council/references/cost-and-redaction.md
- dist/agent-src/skills/ai-council/references/procedure.md
- dist/install/install.mjs
- docs/contracts/ai-council-config.md
- docs/contracts/settings-classes.md
- docs/decisions/ADR-230-council-spend-bound-is-a-ceiling.md
- docs/decisions/ADR-237-end-to-end-execution-authority.md
- docs/decisions/ADR-279-no-spend-bound-by-default.md
- docs/decisions/INDEX.md
- docs/settings-reference.md
- src/agent-src/contexts/execution/roadmap-execution-contract.md
- src/agent-src/contexts/execution/roadmap-process-loop.md
- src/agent-src/scripts/gate_budget.ts
- src/agent-src/scripts/gate_execute.ts
- src/config/agent-settings.template.yml
- src/config/routing-coverage-seed.json
- src/domains/meta/council/command.md
- src/domains/meta/council/debate/command.md
- src/domains/meta/council/default/command.md
- src/domains/meta/pack.yaml
- src/domains/product-basic/roadmap/process-full/command.md
- src/packs/product-reasoning/pack.yaml
- src/scripts/_cli/cmd_explain.ts
- src/scripts/ai_council/config.ts
- src/scripts/ai_council/orchestrator.ts
- src/scripts/ai_council/spend_gate.ts
- src/scripts/check_pack_size.ts
- src/scripts/cost/preflight.mjs
- src/scripts/council_cli.ts
- src/scripts/trigger_eval_grandfather.json
- src/server/schemas/settings.ts
- src/server/writeRoot.test.ts
- src/skills/ai-council/SKILL.md
- src/skills/ai-council/evals/triggers.json
- src/skills/ai-council/references/cost-and-redaction.md
- src/skills/ai-council/references/procedure.md
- tests/_lib/hermetic-env.ts
- tests/cost/budget-fixtures.mjs
- tests/scripts/_cli/cmd_explain_cost_line.test.ts
- tests/scripts/_cli/cmd_update.test.ts
- tests/scripts/ai_council/config.test.ts
- tests/scripts/ai_council/default_budget_is_unbounded.test.ts
- tests/scripts/ai_council/ledger_is_hermetic.test.ts
- tests/scripts/ai_council/ledger_without_limit.test.ts
- tests/scripts/ai_council/orchestrator.test.ts
- tests/scripts/ai_council/spend_gate_zero_is_unbounded.test.ts
- tests/scripts/gate_budget.test.ts
- tests/scripts/gate_budget_absent_caps_run.test.ts
- tests/scripts/gate_execute.test.ts
- tests/scripts/no_default_spend_bound.test.ts
- tests/scripts/routing_signal_measurement.test.ts
- tests/server/serverInfo.test.ts
- tests/server/token.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-spend-bound-where-set.findings.md`:

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
**Honest-null:** 0 findings, scope f4c1b51150a064a9ec211718668b5d691b20eb732096906e5a5e103c8fca4a89, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
