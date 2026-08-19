# R2 completion review — worktree-long-horizon

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

- diff: `diff.patch` — the review scope (branch head 561b486e0c1a4d8bfa2aba3e6b6dd82bf0803c64, review
  artefacts excluded), scope hash `02922a59531e1c7d1f04601e9552f247071ab484af067baa37b0955b956bf5b7`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-council-api-fallback.md
- agents/roadmaps/road-to-long-horizon-execution.md
- agents/templates/.ai-council.yml.example
- dist/agent-src/contexts/execution/roadmap-process-loop.md
- docs/CLAIMS.md
- docs/contracts/ai-council-config.md
- docs/proof.md
- internal/reports/exec-evidence-feasibility.json
- src/agent-src/contexts/execution/roadmap-process-loop.md
- src/cli/registry.ts
- src/config/estate-count-budget.json
- src/config/evaluator-budgets.json
- src/config/gate-violation-baselines.json
- src/scripts/_dispatch.bash
- src/scripts/_lib/council_fallback_posture.ts
- src/scripts/_lib/council_fallback_wiring.ts
- src/scripts/_lib/council_settings_block.ts
- src/scripts/_lib/map_to_object.ts
- src/scripts/_lib/roadmap_checkboxes.ts
- src/scripts/_lib/run_checkpoint.ts
- src/scripts/_lib/unattended_guard.ts
- src/scripts/ai_council/config.ts
- src/scripts/ai_council/events_log.ts
- src/scripts/ai_council/fallback_config.ts
- src/scripts/ai_council/mid_flight_fallback.ts
- src/scripts/ai_council/orchestrator.ts
- src/scripts/ai_council/py_parity.ts
- src/scripts/ai_council/response_render.ts
- src/scripts/ai_council/spend_gate.ts
- src/scripts/ai_council/transport_resolver.ts
- src/scripts/council_cli.ts
- src/scripts/decision_memo.ts
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/concern_registry.ts
- src/scripts/hooks/run_continuation_hook.ts
- src/scripts/hooks/session_eol_hook.ts
- src/scripts/interruption_report.ts
- src/scripts/run_supervise.ts
- src/server/io/yamlIO.ts
- src/server/routes/wizard.ts
- tests/hooks/concern_severity.test.ts
- tests/hooks/run_continuation_dispatch.test.ts
- tests/scripts/ai_council/config.test.ts
- tests/scripts/ai_council/council_cli.test.ts
- tests/scripts/ai_council/events_log.test.ts
- tests/scripts/ai_council/orchestrator.test.ts
- tests/scripts/ai_council/transport_resolver.test.ts
- tests/scripts/decision_memo.test.ts
- tests/scripts/hooks/run_continuation.test.ts
- tests/scripts/interruption_report.test.ts
- tests/scripts/run_checkpoint.test.ts
- tests/scripts/run_supervise.test.ts
- tests/scripts/session_eol_hook.test.ts
- tests/scripts/unattended_guard.test.ts
- tests/server/wizard.aiCouncil.test.ts
- tests/server/yamlIO.upsert.test.ts

## Output format (contract §2.2)

Fill the findings table in `worktree-long-horizon.findings.md`:

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
**Honest-null:** 0 findings, scope 02922a59531e1c7d1f04601e9552f247071ab484af067baa37b0955b956bf5b7, reviewed <YYYY-MM-DD>
```
