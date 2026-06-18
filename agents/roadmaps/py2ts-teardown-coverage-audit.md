# Phase-5 Coverage-Equivalence Audit (2026-06-18)

Companion evidence for `road-to-py2ts-teardown.md` Phase 5. Three parallel
read-only audits classified all **125** Python test modules: does each `.py`
test's behavior already have a `.ts` counterpart, so the `.py` can be deleted
without losing coverage? Prime directive: **lose nothing, no quality regression.**

## Result

| Batch | Modules | COVERED | GAP | OBSOLETE | FIXTURE-KEEP |
|---|---|---|---|---|---|
| A — work_engine | 59 | 47 | 12 | 0 | 0 |
| B — ai_council/hooks/telemetry | 61 | 53 | 7 | 1 | 0 |
| C — rest | 17 | 8 | 8 | 0 | 1 |

A blanket `tests/**/*.py` deletion would have **silently dropped ~25 modules'
worth of coverage.** The audit is the proof the teardown needs.

## Safe to delete now (no port needed)

- **OBSOLETE:** `tests/telemetry/test_cost_floor.py` — a Python import-graph
  invariant (`work_engine.*` must not transitively import `telemetry.*`); does
  not transfer to the TS module system.
- All **COVERED** modules (108) — each has a confirmed `.ts` test exercising
  the same source module (cited per-module in the audit; dominant pattern =
  golden-parity rigs that subprocess the `.py` and byte-compare).

## Never delete (fixtures / test-data)

- `tests/golden/sandbox/repo/tests/test_calculator.py` — the fake-consumer
  repo's own suite, driven as DATA by the golden harness. Plus the 63
  fixtures/recipes/conftest `.py` (sandbox recipes `gt*.py`, `concern_*.py`,
  `_generate.py`, etc.) — test-data representing Python projects the suite
  analyzes, like the 3 `internal/` fixtures.

## GAPs — MUST get `.ts` coverage BEFORE the `.py` is deleted

### Full gaps (no `.ts` test, or a whole behavior class missing)

1. `ai_council/test_pricing.py` — no `pricing.test.ts` (estimate_input_tokens, estimate_cost, load_prices bootstrap, last_monday_utc, is_stale).
2. `hooks/test_hooks_status.py` — `hooks_status.ts` exists, **no** `hooks_status.test.ts` at all.
3. `hooks/test_install_snapshot.py` — per-platform consumer install-output snapshots + install↔manifest binding-drift guard.
4. `hooks/test_event_shape_contract.py` — frozen per-platform native→AC-event alias matrix (all platforms).
5. `telemetry/test_boundary.py` — `open_boundary`/`BoundarySession` lifecycle (coalesce, exception-suppress-flush, double-flush idempotent).
6. `cli/test_hooks_install_claude_flag.py` — `hooks:install --claude/--lifecycle/--regen` bash dispatcher e2e.
7. `conformance/retrieval/test_fixtures.py` — v1-envelope validator + shipped fixtures + 5 rejection cases.
8. `contracts/test_memory_visibility_redaction.py` — privacy/redaction floor (8 synthetic secrets never in output; path-separator allowlist).
9. `contracts/test_readme_audience_order.py` — README audience-heading order contract.
10. `contracts/test_rule_interactions.py` — behavioural 2-axis layer (structural layer IS covered by `lint_rule_interactions.test.ts`).
11. `golden/test_replay.py` — **the entire Golden-Transcript work_engine replay system** (`tests/golden/harness.py` + baseline + recipes) has no `.ts` port. Largest single gap.
12. `implement_ticket/test_shim.py` — package deprecation-shim contract (DeprecationWarning, `_PUBLIC_SURFACE` identity, 13 `_ALIASED_SUBMODULES`).
13. `install/test_consumer_model_tier.py` — `finalize_claude_model_tiers` (symlink→real-dir rewrite injecting native `model:`).
14. `work_engine/test_integration_chat_history.py` — end-to-end `main()` cycle firing append calls + heartbeat-absent.
15. `work_engine/test_integration_full_flow.py` — scripted 4-rebound backend convergence loop + cross-loop memory keep/drop.
16. `work_engine/test_integration_mixed_flow.py` — 5-rebound mixed convergence chain (contract-locked-before-UI).
17. `work_engine/test_state_schema.py` — `_validate_app_spec`/`_validate_ui_scaffold` rejection paths.
18. `work_engine/test_step_polish.py` — stack-dispatch (`ui-polish-<stack>`) + `STACK_DIRECTIVES==KNOWN_STACKS`.
19. `work_engine/test_step_review.py` — stack-dispatch (`ui-design-review-<stack>`).
20. `work_engine/test_cli_hooks.py` — CLI HookHalt-per-event→exit-code table via `main()`.
21. `work_engine/test_persona_integration.py` — end-to-end persona walk through dispatch.
22. `work_engine/test_user_type_integration.py` + `test_user_type_policy.py` — target `src/scripts/skill_linter.py` (outside work_engine port); zero `user_type` `.ts` coverage.

### Partial gaps (module mostly covered; specific assertions missing)

- `ai_council/test_cli.py` — `build_members`, `parse_siblings_overrides`, `resolve_rounds`, `cmd_run`/`cmd_debate` units (CLI output IS covered).
- `hooks/test_dispatcher_feedback.py` — `session_id` path-traversal neutralisation (rest covered).
- `work_engine/hooks/{test_decision_gate_hook,test_decision_trace_hook,test_memory_visibility_hook,test_settings}.py` — Batch A flagged specific uncovered sub-behaviors; Batch B marked covered. **Reconcile per-module before deleting** (the `.ts` test exists; confirm the specific assertions transferred).
- `cli/explain_last/test_cli.py` — `enable_last: false → exit 0` short-circuit unasserted.
- `migrate/test_unified_migrate.py` — v0 `.implement-ticket-state.json`→`.work-state.json` migration action absent from the TS fixture.

## Design fork (→ council, per the standing mandate)

`golden/test_replay.py` + `tests/golden/harness.py` is a **subsystem**, not a
single test. Port the whole Golden-Transcript replay harness to `.ts`, or
retire it (the `.ts` parity suite + per-step golden-parity rigs may already
provide equivalent behavioral pinning)? This is a scope decision, not a
mechanical port — route to the AI council.
