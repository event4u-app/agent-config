---
status: ready
title: Road to a Fast Test Layer (in-process CLI rigs)
owner: matze4u
---

# Road to a Fast Test Layer

PR #741 (py2ts depythonize) added 133 `spawnSync(TSX_BIN, …)` spawn sites.
`tsx` cold-start ~350 ms each → Node Tests ~10–11 min (was 1–2 min).
Fix: run twins **in-process** (`main(argv)` import, stdout/exit capture).

## Phase 1 — Harness + pilot

- [ ] Write `tests/_lib/run_in_process.ts`: `runInProc(mainFn, argv, opts)` — intercept `process.stdout/stderr.write`, overlay `process.env`, save/restore `process.exitCode` + `cwd`, catch `ProcessExit` for `process.exit()` scripts.
- [ ] Pilot: migrate `tests/scripts/measure_density.test.ts` to in-process and confirm the wall-time drops (run twice, check ~1 ms vs ~350 ms).
- [ ] Pilot: migrate `tests/scripts/lint_agent_security.test.ts` to in-process.
- [ ] Pilot: migrate `tests/scripts/inventory_meta_layers.test.ts` to in-process.

## Phase 2 — cmd_* cluster (highest spawn count)

- [ ] Migrate `cmd_doctor` — 56 `runTs` calls via `expectStable`, each now in-process.
- [ ] Migrate `cmd_export`, `cmd_migrate`, `cmd_sync`, `cmd_update`, `cmd_uninstall`.
- [ ] Migrate `cmd_explain`, `cmd_prune`, `cmd_refresh`, `cmd_settings_check`, `cmd_settings_migrate`, `cmd_validate`, `cmd_versions`, `cmd_upgrade`.

## Phase 3 — check_* / lint_* / audit_* / measure_* cluster

- [ ] Migrate `check_condensation`, `check_no_conflict_markers`, `check_no_external_sources`, `check_structural_breaking`, `check_surface_tiers`, `check_trigger_evals`, `check_council_config_location`.
- [ ] Migrate remaining measure/audit/lint rigs: `audit_likelihood`, `audit_overlap`, `measure_markitdown_lift`, `measure_projection_bytes`, `measure_patterns`, `measure_skill_reduction`, `probe_projection_fidelity`, `lint_empty_roadmaps`, `lint_marketplace`, `lint_showcase_sessions`, `lint_skill_originality`, `lint_pack_dependencies`.
- [ ] Migrate remaining one-off rigs: `apply_modules_config`, `cross_repo_retrieve`, `validate_discovery_manifest`, `validate_pack_yaml`, `inventory_frontmatter`, `check_discovery_determinism`, `plan_physical_move`, `migrate_frontmatter_defaults`, `skills_design_tokens_tokens`, `score_skill_selection`.

## Phase 4 — Heavy multi-case suites

- [ ] Migrate `chat_history` (28 spawn sites) — replace `runTs` helper with `runInProc(main, args, { env: { AGENT_CHAT_HISTORY_FILE: file, COLUMNS: '80' } })`.
- [ ] Migrate `cli_python/knowledge_ingest` (23) and `cli_python/workspace_drive` (24).
- [ ] Migrate `knowledge_global_cli`, `_lib_knowledge_global_promote`, `_lib_knowledge_global`, `_lib_knowledge_global_redaction`, `injection_scan_hook`, `pack_mcp_content`, `validate_frontmatter`.

## Phase 5 — Measure + document

- [ ] Confirm Node Tests ≤ 2 min on both OSes (local `time npx vitest run` over the changed files).
- [ ] Update `agents/evidence/py2ts-test-layer-audit.md` with final timing note.
- [ ] Open PR + merge.
