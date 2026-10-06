<!-- evidence-type: analysis -->
# Module reach — 2026-10

Command: `npx tsx src/scripts/report_module_reach.ts --markdown`. 352 module(s) directly under `src/scripts/_lib/`, 23 named in no file outside themselves and their own tests, 55 reached by nothing via import edges or run-by-path.

## Group 1 — imported by a contract test

| module | lines | evidence |
|---|---|---|
| src/scripts/_lib/adherence_detectors.ts | 144 | tests/contracts/adherence_detectors.test.ts |
| src/scripts/_lib/catalogue_layer_parity.ts | 147 | tests/contracts/catalogue_layer_parity.test.ts |
| src/scripts/_lib/experience_card.ts | 273 | tests/contracts/audit_field_provenance.test.ts |
| src/scripts/_lib/experience_report.ts | 152 | tests/contracts/experience_report.test.ts |
| src/scripts/_lib/trigger_shift.ts | 145 | tests/contracts/trigger_shift.test.ts |

## Group 2 — named in an open or deferred step

| module | lines | evidence |
|---|---|---|
| src/scripts/_lib/candidate_pair_delta.ts | 350 | agents/roadmaps/later/road-to-governed-evidence-production.md (later): - [ ] **2.1 An LLM proposer must beat the deterministic one to survive.** |
| src/scripts/_lib/typed_op_grant.ts | 247 | agents/roadmaps/road-to-typed-grants-that-persist.md (active): - [~] **3.1 The grant ledger gains `expires` and `revoked_by`.** A follow-up push, a CI fix, a |

## Group 3 — named in such a roadmap outside any open step

| module | lines | evidence |
|---|---|---|
| src/scripts/_lib/authority_path.ts | 103 | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md (active): - [x] **11.1 The strictest path, reserved for authority.** An independent test author, an |
| src/scripts/_lib/cascade_base.ts | 95 | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md (active): - [x] **5.1 Sync before every push and before delivery.** Fetch; merge the remote target into |
| src/scripts/_lib/council_transport.ts | 130 | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md (active): - [x] **10.1 Pause and report, never ask.** The posture is CLI → CLI quota exhausted → API |
| src/scripts/_lib/delivery_ready.ts | 113 | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md (active): - [x] **3.1 Name the required layers, in order.** A targeted local RED then GREEN → quality |
| src/scripts/_lib/rides_along.ts | 103 | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md (active): - [x] **6.1 What rides along, and what does not.** During a mission the agent may add |
| src/scripts/_lib/self_repair_class_b.ts | 172 | agents/roadmaps/stubs/road-to-org-telemetry-sink.md (stubs) |
| src/scripts/_lib/test_provenance.ts | 172 | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md (active): - [x] AC-2 — independent test provenance is recorded per test, and critical tests are at L3 or |
| src/scripts/_lib/typed_op_watch.ts | 186 | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md (active): - [x] **7.1 Layer them, and measure before enforcing.** Forge protection → the host hook where |

## Group 4 — named in no live roadmap

| module | lines | importing tests |
|---|---|---|
| src/scripts/_lib/config_chain.ts | 478 | 1 |
| src/scripts/_lib/conformance_report.ts | 404 | 2 |
| src/scripts/_lib/eval_discrimination.ts | 96 | 1 |
| src/scripts/_lib/file_slicer.ts | 118 | 1 |
| src/scripts/_lib/legacy_boundary_map.ts | 229 | 1 |
| src/scripts/_lib/minimality_tiebreak.ts | 169 | 2 |
| src/scripts/_lib/overbuild_lens_contract.ts | 197 | 2 |
| src/scripts/_lib/role_split.ts | 339 | 1 |

## Every module under `_lib` — full facts

| module | lines | importing tests | named by production | has entry point | registry | reached |
|---|---|---|---|---|---|---|
| src/scripts/_lib/ac_heading.ts | 31 | 0 | yes | no | — | yes |
| src/scripts/_lib/activation_ladder.ts | 256 | 5 | yes | no | — | yes |
| src/scripts/_lib/activation_payload.ts | 248 | 1 | yes | no | — | yes |
| src/scripts/_lib/activation_receipt_producer.ts | 342 | 2 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/activation_states.ts | 89 | 1 | yes | no | — | no |
| src/scripts/_lib/adherence_detectors.ts | 144 | 1 | no | no | — | no |
| src/scripts/_lib/adr_frontmatter.ts | 530 | 2 | yes | no | — | yes |
| src/scripts/_lib/adversarial_bench_score.ts | 107 | 1 | yes | no | — | yes |
| src/scripts/_lib/adversarial_council_gate.ts | 99 | 0 | yes | no | — | yes |
| src/scripts/_lib/adversarial_reconcile.ts | 188 | 0 | yes | no | — | no |
| src/scripts/_lib/agent_settings.ts | 1511 | 15 | yes | no | src/config/agent-settings.template.yml, src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/agent_src.ts | 748 | 15 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/agent_user_profile.ts | 382 | 6 | yes | yes | — | yes |
| src/scripts/_lib/agents_overlay.ts | 193 | 1 | yes | no | — | yes |
| src/scripts/_lib/anchor_eval.ts | 312 | 1 | yes | no | — | yes |
| src/scripts/_lib/arith_claims.ts | 182 | 1 | yes | no | — | yes |
| src/scripts/_lib/arm_ranking.ts | 63 | 2 | yes | no | — | no |
| src/scripts/_lib/artifact_maturity.ts | 243 | 1 | yes | no | — | no |
| src/scripts/_lib/as_of.ts | 413 | 3 | yes | yes | src/config/memory-twin-verdicts.yml | yes |
| src/scripts/_lib/asset_delivery_ledger.ts | 304 | 1 | yes | no | — | yes |
| src/scripts/_lib/audit_field_provenance.ts | 96 | 2 | yes | no | — | yes |
| src/scripts/_lib/authority_path.ts | 103 | 1 | no | no | — | no |
| src/scripts/_lib/auto_dispatch.ts | 269 | 9 | yes | no | — | yes |
| src/scripts/_lib/base_ref_payload.ts | 316 | 1 | yes | no | — | yes |
| src/scripts/_lib/base_tree.ts | 176 | 1 | yes | no | src/config/estate-count-budget.json | yes |
| src/scripts/_lib/bench_ab_activation.ts | 369 | 2 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_cache.ts | 400 | 2 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_complexity.ts | 440 | 1 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_pinned_repo.ts | 163 | 1 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_safety_tier.ts | 143 | 2 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_scoring.ts | 353 | 1 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_scoring_v2.ts | 777 | 3 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_search_adherence.ts | 424 | 3 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_size_claim.ts | 301 | 1 | yes | no | — | yes |
| src/scripts/_lib/bench_ab_workspace.ts | 121 | 2 | yes | no | — | yes |
| src/scripts/_lib/bench_cost.ts | 397 | 1 | yes | no | — | yes |
| src/scripts/_lib/bench_quality.ts | 238 | 1 | yes | no | — | yes |
| src/scripts/_lib/bench_report.ts | 256 | 1 | yes | no | — | yes |
| src/scripts/_lib/bench_telegraph.ts | 517 | 2 | yes | no | — | yes |
| src/scripts/_lib/bench_telegraph_report.ts | 273 | 1 | yes | no | — | yes |
| src/scripts/_lib/benchmark_cache_fields.ts | 159 | 1 | yes | no | — | yes |
| src/scripts/_lib/billing_grant.ts | 166 | 2 | yes | no | — | yes |
| src/scripts/_lib/billing_grant_cli.ts | 124 | 1 | yes | no | — | yes |
| src/scripts/_lib/blocked_by_marker.ts | 190 | 1 | yes | no | src/config/loop-surfaces.yaml | no |
| src/scripts/_lib/body_portable.ts | 103 | 1 | yes | no | — | yes |
| src/scripts/_lib/branch_convergence.ts | 187 | 2 | yes | no | — | yes |
| src/scripts/_lib/candidate_pair_delta.ts | 350 | 1 | no | no | — | no |
| src/scripts/_lib/candidate_proposer.ts | 403 | 3 | yes | no | — | yes |
| src/scripts/_lib/candidate_record.ts | 602 | 12 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/capsule_trigger.ts | 125 | 1 | yes | no | src/config/loop-surfaces.yaml | no |
| src/scripts/_lib/capture_rate.ts | 320 | 1 | yes | no | — | yes |
| src/scripts/_lib/carrier_divergence.ts | 254 | 1 | yes | no | — | yes |
| src/scripts/_lib/cascade_base.ts | 95 | 2 | no | no | — | no |
| src/scripts/_lib/cascade_stage_enumeration.ts | 93 | 1 | yes | no | — | no |
| src/scripts/_lib/catalog_score.ts | 65 | 1 | yes | no | — | yes |
| src/scripts/_lib/catalogue_layer_parity.ts | 147 | 2 | no | no | — | no |
| src/scripts/_lib/cc_transcript.ts | 473 | 4 | yes | no | src/config/cost-parity-budget.json, src/config/dispatch-economy-metrics.json, src/config/metric-registry.yml, src/config/recycle-threshold-budget.json | yes |
| src/scripts/_lib/changelog_eras.ts | 556 | 2 | yes | no | — | yes |
| src/scripts/_lib/claude_builtin_names.ts | 149 | 0 | yes | no | — | yes |
| src/scripts/_lib/claude_desktop_bundler.ts | 325 | 1 | yes | no | — | yes |
| src/scripts/_lib/claude_plugin.ts | 194 | 0 | yes | no | — | yes |
| src/scripts/_lib/claude_settings_hooks.ts | 288 | 6 | yes | no | — | yes |
| src/scripts/_lib/cli_wrapper.ts | 90 | 3 | yes | no | — | yes |
| src/scripts/_lib/collector_denominator.ts | 772 | 6 | yes | no | — | yes |
| src/scripts/_lib/collector_record.ts | 341 | 6 | yes | no | — | yes |
| src/scripts/_lib/collector_store.ts | 665 | 5 | yes | no | — | yes |
| src/scripts/_lib/collector_supervision.ts | 828 | 3 | yes | no | — | yes |
| src/scripts/_lib/compile_time_toggles.ts | 81 | 0 | yes | no | — | yes |
| src/scripts/_lib/concern_estate.ts | 78 | 1 | yes | no | src/config/estate-count-budget.json | yes |
| src/scripts/_lib/concern_sla_window.ts | 201 | 0 | yes | no | — | yes |
| src/scripts/_lib/config_chain.ts | 478 | 1 | no | no | — | no |
| src/scripts/_lib/config_cost.ts | 210 | 1 | yes | no | — | yes |
| src/scripts/_lib/conformance_report.ts | 404 | 2 | no | no | — | no |
| src/scripts/_lib/confusables.ts | 102 | 2 | yes | no | — | yes |
| src/scripts/_lib/consequence_objects.ts | 153 | 0 | yes | no | — | yes |
| src/scripts/_lib/context_observation.ts | 133 | 2 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/continuation_ladder.ts | 336 | 1 | yes | no | src/config/gate-violation-baselines.json, src/config/loop-surfaces.yaml | yes |
| src/scripts/_lib/continuity_slot.ts | 296 | 1 | yes | no | — | yes |
| src/scripts/_lib/continuity_surface.ts | 297 | 1 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/continuity_writer.ts | 313 | 2 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/corpus_manifest.ts | 744 | 1 | yes | no | — | yes |
| src/scripts/_lib/council_fallback_posture.ts | 129 | 1 | yes | no | — | yes |
| src/scripts/_lib/council_fallback_wiring.ts | 187 | 1 | yes | no | — | yes |
| src/scripts/_lib/council_settings_block.ts | 159 | 1 | yes | no | — | yes |
| src/scripts/_lib/council_transport.ts | 130 | 2 | no | no | — | no |
| src/scripts/_lib/counted_probe.ts | 143 | 2 | yes | no | — | yes |
| src/scripts/_lib/curator_ops.ts | 173 | 4 | yes | no | — | yes |
| src/scripts/_lib/delivery_arm_experiment.ts | 283 | 1 | yes | no | — | yes |
| src/scripts/_lib/delivery_criticality.ts | 127 | 1 | yes | no | — | no |
| src/scripts/_lib/delivery_ready.ts | 113 | 2 | no | no | — | no |
| src/scripts/_lib/design_system_import.ts | 1008 | 2 | yes | no | — | yes |
| src/scripts/_lib/design_tolerance.ts | 282 | 2 | yes | no | src/config/agent-settings.template.yml | no |
| src/scripts/_lib/detect_target_license.ts | 715 | 1 | yes | no | — | yes |
| src/scripts/_lib/doctor_runtime_checks.ts | 71 | 0 | yes | no | — | yes |
| src/scripts/_lib/dropped_decision.ts | 143 | 1 | yes | no | — | yes |
| src/scripts/_lib/duplicate_scope_census.ts | 78 | 2 | yes | no | — | yes |
| src/scripts/_lib/empty_cycles.ts | 89 | 1 | yes | no | — | no |
| src/scripts/_lib/env_kill_switch.ts | 38 | 1 | yes | no | — | yes |
| src/scripts/_lib/envelope_grounding.ts | 247 | 1 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/environment_detector.ts | 493 | 8 | yes | no | — | yes |
| src/scripts/_lib/estate_offsets.ts | 242 | 1 | yes | no | — | yes |
| src/scripts/_lib/eval_discrimination.ts | 96 | 1 | no | no | — | no |
| src/scripts/_lib/eval_publication.ts | 355 | 2 | yes | no | — | no |
| src/scripts/_lib/evaluation_cascade.ts | 453 | 5 | yes | no | — | yes |
| src/scripts/_lib/evaluation_vector.ts | 284 | 7 | yes | no | — | yes |
| src/scripts/_lib/evaluator_contract.ts | 160 | 1 | yes | no | — | yes |
| src/scripts/_lib/evaluator_promotion.ts | 226 | 1 | yes | no | — | no |
| src/scripts/_lib/evidence_basis.ts | 119 | 3 | yes | no | — | yes |
| src/scripts/_lib/evolution_roi.ts | 563 | 2 | yes | no | — | yes |
| src/scripts/_lib/exec_evidence.ts | 279 | 5 | yes | no | — | yes |
| src/scripts/_lib/exemption_shape.ts | 144 | 1 | yes | no | — | yes |
| src/scripts/_lib/experience_card.ts | 273 | 2 | no | no | — | no |
| src/scripts/_lib/experience_report.ts | 152 | 1 | no | no | — | no |
| src/scripts/_lib/experiment_binding.ts | 96 | 1 | yes | no | — | yes |
| src/scripts/_lib/experiment_freeze.ts | 113 | 2 | yes | no | — | yes |
| src/scripts/_lib/file_slicer.ts | 118 | 1 | no | no | — | no |
| src/scripts/_lib/fnv.ts | 24 | 0 | yes | no | — | yes |
| src/scripts/_lib/foreign_scan.ts | 107 | 0 | yes | no | — | yes |
| src/scripts/_lib/forge_protection.ts | 382 | 4 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/forge_reader.ts | 559 | 2 | yes | no | — | yes |
| src/scripts/_lib/fs_atomic.ts | 173 | 3 | yes | no | — | yes |
| src/scripts/_lib/gate_baseline.ts | 363 | 5 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/gate_ledger.ts | 300 | 7 | yes | no | src/config/gate-coverage.yml, src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/gate_population.ts | 71 | 2 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/gate_result.ts | 102 | 1 | yes | no | — | yes |
| src/scripts/_lib/gate_self_test.ts | 130 | 3 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/generated_by.ts | 67 | 2 | yes | no | — | yes |
| src/scripts/_lib/gh_transient.ts | 81 | 1 | yes | no | — | yes |
| src/scripts/_lib/git_common_dir.ts | 302 | 3 | yes | no | — | yes |
| src/scripts/_lib/git_env.ts | 41 | 1 | yes | no | — | yes |
| src/scripts/_lib/gitignore_block.ts | 315 | 1 | yes | yes | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/global_deploy_inventory.ts | 708 | 3 | yes | no | — | yes |
| src/scripts/_lib/graph_feeder_record.ts | 437 | 1 | yes | no | — | yes |
| src/scripts/_lib/guidelines_lane.ts | 165 | 1 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/harness_evolution_guards.ts | 240 | 3 | yes | no | src/config/harness-evolution-budget.json | yes |
| src/scripts/_lib/headless_invocation.ts | 286 | 2 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/hook_effect_probe.ts | 142 | 1 | yes | no | src/config/evaluator-budgets.json | yes |
| src/scripts/_lib/hook_platform_keys.ts | 28 | 1 | yes | no | — | yes |
| src/scripts/_lib/hook_settings.ts | 271 | 3 | yes | no | — | yes |
| src/scripts/_lib/host_capability.ts | 429 | 3 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/host_denominator.ts | 688 | 1 | yes | no | — | yes |
| src/scripts/_lib/host_env_write.ts | 112 | 1 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/host_hook_merge.ts | 166 | 1 | yes | no | — | yes |
| src/scripts/_lib/host_launch.ts | 73 | 1 | yes | no | — | yes |
| src/scripts/_lib/host_listing_model.ts | 193 | 1 | yes | no | — | yes |
| src/scripts/_lib/host_permission_checks.ts | 252 | 1 | yes | no | — | yes |
| src/scripts/_lib/host_projection_reach.ts | 158 | 0 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/ignored_blocker.ts | 156 | 2 | yes | no | — | no |
| src/scripts/_lib/injection_effect.ts | 152 | 1 | yes | no | src/config/host-injection-effect.json | yes |
| src/scripts/_lib/install_drift.ts | 195 | 1 | yes | no | — | yes |
| src/scripts/_lib/install_layout.ts | 88 | 1 | yes | no | — | yes |
| src/scripts/_lib/install_reach_checks.ts | 528 | 1 | yes | no | — | yes |
| src/scripts/_lib/install_regenerator.ts | 158 | 1 | yes | yes | — | yes |
| src/scripts/_lib/installed_layer.ts | 539 | 1 | yes | no | src/config/host-instruction-limits.json | yes |
| src/scripts/_lib/installed_lock.ts | 532 | 5 | yes | no | — | yes |
| src/scripts/_lib/installed_tools.ts | 519 | 8 | yes | no | — | yes |
| src/scripts/_lib/json_duplicate_keys.ts | 151 | 1 | yes | no | — | yes |
| src/scripts/_lib/json_merge.ts | 83 | 1 | yes | no | — | yes |
| src/scripts/_lib/json_pointers.ts | 471 | 2 | yes | no | — | yes |
| src/scripts/_lib/json_python_parity.ts | 128 | 0 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/judge_hygiene.ts | 229 | 2 | yes | no | src/config/harness-evolution-budget.json | no |
| src/scripts/_lib/judgment_ladder.ts | 635 | 9 | yes | no | — | yes |
| src/scripts/_lib/kernel_rules.ts | 47 | 8 | yes | no | — | yes |
| src/scripts/_lib/knowledge_events.ts | 194 | 3 | yes | no | — | yes |
| src/scripts/_lib/knowledge_global.ts | 841 | 2 | yes | yes | — | yes |
| src/scripts/_lib/knowledge_global_promote.ts | 626 | 2 | yes | yes | — | yes |
| src/scripts/_lib/knowledge_global_redaction.ts | 509 | 2 | yes | yes | — | yes |
| src/scripts/_lib/layer_overlap_notice.ts | 139 | 1 | yes | no | — | yes |
| src/scripts/_lib/lean_projection_mode.ts | 443 | 5 | yes | no | — | yes |
| src/scripts/_lib/legacy_boundary_map.ts | 229 | 1 | no | no | — | no |
| src/scripts/_lib/lexical_index.ts | 169 | 2 | yes | no | src/config/memory-twin-verdicts.yml | yes |
| src/scripts/_lib/lexical_shortlist.ts | 216 | 1 | yes | no | — | yes |
| src/scripts/_lib/link_crypto.ts | 345 | 4 | yes | yes | src/config/agent-settings.template.yml | yes |
| src/scripts/_lib/linked_projects.ts | 614 | 3 | yes | no | — | yes |
| src/scripts/_lib/llm_candidate_proposer.ts | 462 | 3 | yes | no | — | yes |
| src/scripts/_lib/llm_proposer_transport.ts | 164 | 4 | yes | no | — | yes |
| src/scripts/_lib/loop_guards.ts | 300 | 3 | yes | no | src/config/loop-surfaces.yaml | yes |
| src/scripts/_lib/loop_surfaces.ts | 383 | 0 | yes | no | src/config/loop-surfaces.yaml | yes |
| src/scripts/_lib/loss_class.ts | 130 | 1 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/machine_wake.ts | 65 | 0 | yes | no | — | yes |
| src/scripts/_lib/managed_agents_folder.ts | 182 | 1 | yes | no | — | yes |
| src/scripts/_lib/map_to_object.ts | 17 | 0 | yes | no | — | yes |
| src/scripts/_lib/mcp_bridge.ts | 412 | 4 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/mcp_consent_residual.ts | 174 | 1 | yes | no | — | yes |
| src/scripts/_lib/md_prose_lines.ts | 178 | 0 | yes | no | — | yes |
| src/scripts/_lib/md_section.ts | 130 | 2 | yes | no | — | yes |
| src/scripts/_lib/md_table.ts | 28 | 1 | yes | no | — | yes |
| src/scripts/_lib/measured_payload_ceiling.ts | 425 | 1 | yes | no | src/config/preamble-payload-budget.json, src/config/preamble-payload-exceptions.json | yes |
| src/scripts/_lib/measured_render.ts | 98 | 1 | yes | no | — | yes |
| src/scripts/_lib/memory_fts_index.ts | 391 | 1 | yes | no | src/config/continuity-surface.json, src/config/memory-twin-verdicts.yml | yes |
| src/scripts/_lib/minimality_tiebreak.ts | 169 | 2 | no | no | — | no |
| src/scripts/_lib/mission_record.ts | 191 | 2 | yes | no | — | no |
| src/scripts/_lib/model_tier.ts | 75 | 19 | yes | no | src/config/agent-settings.template.yml | yes |
| src/scripts/_lib/module_detection.ts | 276 | 1 | yes | no | — | yes |
| src/scripts/_lib/module_reach.ts | 452 | 1 | yes | yes | — | yes |
| src/scripts/_lib/neighbour_census.ts | 761 | 2 | yes | no | — | yes |
| src/scripts/_lib/neighbour_scan.ts | 123 | 1 | yes | no | — | yes |
| src/scripts/_lib/neighbour_tool_use.ts | 190 | 1 | yes | no | — | yes |
| src/scripts/_lib/obligation_frequency.ts | 608 | 2 | yes | no | — | yes |
| src/scripts/_lib/obligations.ts | 514 | 22 | yes | no | src/config/continuity-surface.json, src/config/evaluator-budgets.json, src/config/host-injection-effect.json, src/config/rule-activation-census.json | yes |
| src/scripts/_lib/one_resolver_invariant.ts | 450 | 1 | yes | no | — | no |
| src/scripts/_lib/orchestration_gate.ts | 111 | 3 | yes | no | — | no |
| src/scripts/_lib/orchestration_record.ts | 666 | 5 | yes | no | src/config/dispatch-economy-metrics.json | yes |
| src/scripts/_lib/orchestration_savings.ts | 233 | 1 | yes | no | — | yes |
| src/scripts/_lib/outcome_envelope.ts | 233 | 4 | yes | no | — | yes |
| src/scripts/_lib/outcome_vocabularies.ts | 256 | 4 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/overbuild_lens_contract.ts | 197 | 2 | no | no | — | no |
| src/scripts/_lib/package_root.ts | 73 | 7 | yes | no | — | yes |
| src/scripts/_lib/packed_binary_predicate.ts | 263 | 2 | yes | no | src/config/packed-binary-manifest.json | yes |
| src/scripts/_lib/paired_stats.ts | 246 | 0 | yes | no | — | yes |
| src/scripts/_lib/paired_verdict.ts | 227 | 9 | yes | no | src/config/harness-evolution-budget.json | yes |
| src/scripts/_lib/pathology_archive.ts | 394 | 1 | yes | no | — | yes |
| src/scripts/_lib/payload_catalogue_completeness.ts | 212 | 1 | yes | no | — | yes |
| src/scripts/_lib/payload_hash_drift.ts | 127 | 2 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/pin_resolver.ts | 299 | 3 | yes | yes | — | yes |
| src/scripts/_lib/planning_settings.ts | 44 | 0 | yes | no | — | yes |
| src/scripts/_lib/platform_anchor.ts | 1054 | 3 | yes | no | src/config/platform-anchor.json | yes |
| src/scripts/_lib/prefix_stable_surfaces.ts | 124 | 1 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/preservation_migration.ts | 292 | 1 | yes | no | — | yes |
| src/scripts/_lib/privacy_class.ts | 48 | 3 | yes | no | — | yes |
| src/scripts/_lib/probe_inputs.ts | 272 | 3 | yes | no | — | yes |
| src/scripts/_lib/promotion_capability.ts | 316 | 1 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/promotion_evidence.ts | 415 | 2 | yes | no | — | yes |
| src/scripts/_lib/promotion_review.ts | 295 | 1 | yes | no | — | no |
| src/scripts/_lib/prompt_shape.ts | 227 | 2 | yes | no | — | yes |
| src/scripts/_lib/prune_empty_dirs.ts | 81 | 0 | yes | no | — | yes |
| src/scripts/_lib/py_random.ts | 213 | 2 | yes | no | — | yes |
| src/scripts/_lib/quota_parked.ts | 134 | 1 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/ratchet_base_ref.ts | 374 | 2 | yes | no | — | yes |
| src/scripts/_lib/ratification_artifact.ts | 279 | 2 | yes | no | — | yes |
| src/scripts/_lib/read_surface_scan.ts | 323 | 1 | yes | no | — | yes |
| src/scripts/_lib/recycle_envelope_paths.ts | 314 | 13 | yes | no | — | yes |
| src/scripts/_lib/reddit_thread_parse.ts | 599 | 2 | yes | yes | — | no |
| src/scripts/_lib/regression_neighbourhood.ts | 397 | 1 | yes | no | src/config/gate-violation-baselines.json | no |
| src/scripts/_lib/release_findings_ingest.ts | 325 | 1 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/release_highlights.ts | 777 | 4 | yes | no | — | yes |
| src/scripts/_lib/release_holds.ts | 494 | 1 | yes | no | — | yes |
| src/scripts/_lib/release_material.ts | 370 | 2 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/release_migration_gate.ts | 201 | 0 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/release_position.ts | 97 | 1 | yes | no | — | yes |
| src/scripts/_lib/release_scope.ts | 208 | 1 | yes | no | — | yes |
| src/scripts/_lib/release_tag_dispatch.ts | 64 | 0 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/repeated_failure.ts | 123 | 1 | yes | no | src/config/metric-registry.yml | no |
| src/scripts/_lib/repeated_run.ts | 78 | 2 | yes | no | — | yes |
| src/scripts/_lib/repo_root.ts | 112 | 6 | yes | no | — | yes |
| src/scripts/_lib/reserved_name_sweep.ts | 74 | 1 | yes | no | — | yes |
| src/scripts/_lib/retired_status.ts | 75 | 1 | yes | no | — | yes |
| src/scripts/_lib/retrieval_sanitize.ts | 359 | 5 | yes | no | src/config/memory-twin-verdicts.yml | yes |
| src/scripts/_lib/review_baseline.ts | 255 | 1 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/review_coverage.ts | 135 | 2 | yes | no | — | yes |
| src/scripts/_lib/review_independence.ts | 164 | 2 | yes | no | src/config/gate-coverage.yml | yes |
| src/scripts/_lib/review_skipped_record.ts | 216 | 4 | yes | no | — | yes |
| src/scripts/_lib/review_telemetry.ts | 197 | 1 | yes | no | — | yes |
| src/scripts/_lib/rides_along.ts | 103 | 1 | no | no | — | no |
| src/scripts/_lib/risk_paths.ts | 161 | 1 | yes | no | — | yes |
| src/scripts/_lib/roadmap_checkboxes.ts | 89 | 1 | yes | no | — | yes |
| src/scripts/_lib/roadmap_granularity.ts | 158 | 1 | yes | no | — | yes |
| src/scripts/_lib/role_split.ts | 339 | 1 | no | no | — | no |
| src/scripts/_lib/router_match.ts | 302 | 5 | yes | no | — | yes |
| src/scripts/_lib/routing_corpus.ts | 308 | 3 | yes | no | — | yes |
| src/scripts/_lib/routing_index_input.ts | 105 | 1 | yes | no | — | yes |
| src/scripts/_lib/rtk_allowlist.ts | 45 | 1 | yes | no | — | no |
| src/scripts/_lib/rule_consequence_class.ts | 72 | 2 | yes | no | src/config/rule-consequence-class.json | yes |
| src/scripts/_lib/rule_injection.ts | 381 | 5 | yes | no | src/config/hook-token-budget.json | yes |
| src/scripts/_lib/rule_law_section.ts | 148 | 5 | yes | no | — | yes |
| src/scripts/_lib/rule_layer_overlap.ts | 313 | 1 | yes | no | — | yes |
| src/scripts/_lib/run_checkpoint.ts | 463 | 4 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/runtime_journal.ts | 1530 | 8 | yes | no | src/config/agent-settings.template.yml, src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/runtime_wiring_checks.ts | 442 | 1 | yes | no | — | yes |
| src/scripts/_lib/scan_scope.ts | 160 | 15 | yes | no | src/config/gate-coverage.yml, src/config/memory-twin-verdicts.yml, src/config/metric-registry.yml | yes |
| src/scripts/_lib/scoped_projection.ts | 359 | 2 | yes | no | — | yes |
| src/scripts/_lib/script_output.ts | 148 | 1 | yes | no | — | yes |
| src/scripts/_lib/secret_detector.ts | 329 | 1 | yes | no | — | yes |
| src/scripts/_lib/security_lint.ts | 832 | 8 | yes | no | — | yes |
| src/scripts/_lib/self_repair.ts | 919 | 6 | yes | no | — | yes |
| src/scripts/_lib/self_repair_class_b.ts | 172 | 1 | no | no | — | no |
| src/scripts/_lib/self_repair_store.ts | 455 | 2 | yes | no | — | yes |
| src/scripts/_lib/semantic_noop.ts | 168 | 1 | yes | no | — | yes |
| src/scripts/_lib/session_eol.ts | 360 | 4 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/session_index_trust.ts | 388 | 4 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/session_register.ts | 520 | 5 | yes | no | — | yes |
| src/scripts/_lib/session_role.ts | 43 | 1 | yes | no | — | yes |
| src/scripts/_lib/settings_renamed_keys.ts | 83 | 1 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/shell_write_shapes.ts | 109 | 0 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/shingle_similarity.ts | 147 | 2 | yes | no | — | yes |
| src/scripts/_lib/skill_catalogue.ts | 1317 | 3 | yes | yes | src/config/estate-count-budget.json | yes |
| src/scripts/_lib/skill_catalogue_series.ts | 503 | 0 | yes | no | — | yes |
| src/scripts/_lib/skill_estate.ts | 116 | 1 | yes | no | src/config/estate-count-budget.json | yes |
| src/scripts/_lib/skill_origin.ts | 255 | 1 | yes | no | src/config/agents-paths.yml | yes |
| src/scripts/_lib/source_digest.ts | 201 | 1 | yes | yes | — | yes |
| src/scripts/_lib/source_redact.ts | 261 | 1 | yes | no | — | yes |
| src/scripts/_lib/source_shape.ts | 503 | 5 | yes | no | — | yes |
| src/scripts/_lib/source_snapshot_dedup.ts | 200 | 1 | yes | no | — | yes |
| src/scripts/_lib/spawn_env.ts | 128 | 2 | yes | no | — | yes |
| src/scripts/_lib/sqlite_guard.ts | 192 | 4 | yes | no | — | yes |
| src/scripts/_lib/sqlite_schema.ts | 23 | 0 | yes | no | — | yes |
| src/scripts/_lib/standing_bound_ratchet.ts | 334 | 2 | yes | no | src/config/preamble-payload-budget.json | yes |
| src/scripts/_lib/stat_index.ts | 99 | 1 | yes | no | — | yes |
| src/scripts/_lib/stdin.ts | 117 | 87 | yes | no | src/config/agent-settings.template.yml, src/config/gate-coverage.yml, src/config/gate-reachability-exemptions.json | yes |
| src/scripts/_lib/structural_hiding.ts | 623 | 1 | yes | no | — | yes |
| src/scripts/_lib/structured_ask.ts | 161 | 2 | yes | no | — | yes |
| src/scripts/_lib/subagent_bundle.ts | 155 | 1 | yes | no | — | no |
| src/scripts/_lib/subagent_capsule.ts | 1015 | 11 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/subagent_response.ts | 269 | 4 | yes | no | src/config/dispatch-economy-metrics.json | yes |
| src/scripts/_lib/subagent_routing.ts | 106 | 3 | yes | no | — | yes |
| src/scripts/_lib/subagent_spawn.ts | 164 | 19 | yes | no | — | no |
| src/scripts/_lib/subagent_steering.ts | 392 | 1 | yes | no | — | no |
| src/scripts/_lib/surface.ts | 87 | 392 | yes | no | src/config/agent-settings.template.yml, src/config/assurance-capability-registry.json, src/config/canonical-terms.yml, src/config/ci-local-parity.yml, src/config/continuity-surface.json, src/config/cost-parity-budget.json, src/config/drafting-channels.yml, src/config/estate-count-budget.json, src/config/evaluator-budgets.json, src/config/gate-coverage.yml, src/config/gate-violation-baselines.json, src/config/host-capabilities.yml, src/config/host-injection-effect.json, src/config/lapsed-beta-baseline.json, src/config/loop-surfaces.yaml, src/config/pack-size-budget.json, src/config/placeholder-drift-budget.json, src/config/platform-anchor.json, src/config/preamble-payload-budget.json, src/config/prelaunch-areas.yml, src/config/publish-surface.json, src/config/quorum-attendance-budget.json, src/config/ratification-policy.json, src/config/reach-channels.yml, src/config/release-gate-locality.yml, src/config/routing-coverage-seed.json, src/config/rule-consequence-class.json, src/config/rule-stub-ceilings.json, src/config/surface-matrix.yml | yes |
| src/scripts/_lib/surface_tiers.ts | 128 | 0 | yes | no | — | yes |
| src/scripts/_lib/tamper_vocabulary.ts | 243 | 1 | yes | no | — | yes |
| src/scripts/_lib/test_delta.ts | 167 | 1 | yes | no | — | yes |
| src/scripts/_lib/test_provenance.ts | 172 | 2 | no | no | — | no |
| src/scripts/_lib/test_red_state.ts | 155 | 1 | yes | no | src/config/assurance-capability-registry.json, src/config/continuity-surface.json | no |
| src/scripts/_lib/text_similarity.ts | 76 | 2 | yes | no | — | yes |
| src/scripts/_lib/thin_rules.ts | 541 | 1 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/tier_budget_routing.ts | 66 | 2 | yes | no | — | yes |
| src/scripts/_lib/token_count.ts | 202 | 4 | yes | no | src/config/budgets.yml, src/config/estate-count-budget.json | yes |
| src/scripts/_lib/tolerance_shadow.ts | 178 | 1 | yes | no | — | no |
| src/scripts/_lib/tool_adapter_registry.ts | 128 | 1 | yes | no | — | yes |
| src/scripts/_lib/tool_probe.ts | 360 | 3 | yes | no | — | yes |
| src/scripts/_lib/touched_file_quality.ts | 435 | 2 | yes | no | src/config/agent-settings.template.yml | yes |
| src/scripts/_lib/transcript_entry.ts | 81 | 0 | yes | no | — | yes |
| src/scripts/_lib/transcript_reads.ts | 208 | 1 | yes | no | — | yes |
| src/scripts/_lib/trigger_eval_floors.ts | 41 | 2 | yes | no | — | yes |
| src/scripts/_lib/trigger_routers.ts | 281 | 3 | yes | no | — | yes |
| src/scripts/_lib/trigger_shift.ts | 145 | 1 | no | no | — | no |
| src/scripts/_lib/tty_prompt.ts | 77 | 0 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/turn_end_refusals.ts | 1134 | 6 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/turn_end_transcript.ts | 217 | 0 | yes | no | — | yes |
| src/scripts/_lib/typed_op_grant.ts | 247 | 2 | no | no | — | no |
| src/scripts/_lib/typed_op_watch.ts | 186 | 1 | no | no | — | no |
| src/scripts/_lib/ui_authority.ts | 460 | 3 | yes | no | — | no |
| src/scripts/_lib/ui_surface.ts | 98 | 4 | yes | no | src/config/agent-settings.template.yml, src/config/rule-stub-ceilings.json | yes |
| src/scripts/_lib/unattended_guard.ts | 372 | 2 | yes | no | src/config/continuity-surface.json | yes |
| src/scripts/_lib/unified_diff.ts | 122 | 0 | yes | no | — | yes |
| src/scripts/_lib/untrusted_content.ts | 260 | 4 | yes | no | — | yes |
| src/scripts/_lib/update_check.ts | 298 | 4 | yes | no | src/config/agent-settings.template.yml, src/config/gate-coverage.yml | yes |
| src/scripts/_lib/user_global_memory_audit.ts | 188 | 1 | yes | no | — | no |
| src/scripts/_lib/user_global_observations.ts | 831 | 8 | yes | yes | — | yes |
| src/scripts/_lib/user_global_paths.ts | 330 | 8 | yes | no | — | yes |
| src/scripts/_lib/user_global_revocations.ts | 111 | 4 | yes | no | — | yes |
| src/scripts/_lib/user_memory_gate_counters.ts | 292 | 1 | yes | yes | — | yes |
| src/scripts/_lib/value_ladder.ts | 883 | 3 | yes | no | — | yes |
| src/scripts/_lib/value_report.ts | 618 | 2 | yes | no | — | yes |
| src/scripts/_lib/vendored_grammar_upstream.ts | 281 | 1 | yes | no | src/config/packed-binary-manifest.json | no |
| src/scripts/_lib/verification_command.ts | 325 | 1 | yes | no | — | yes |
| src/scripts/_lib/verification_evidence.ts | 648 | 4 | yes | no | — | yes |
| src/scripts/_lib/verify_budget.ts | 58 | 1 | yes | no | — | no |
| src/scripts/_lib/verify_clause.ts | 281 | 3 | yes | no | — | yes |
| src/scripts/_lib/windsurf_render.ts | 64 | 0 | yes | no | src/config/gate-violation-baselines.json | yes |
| src/scripts/_lib/worker_budget.ts | 143 | 3 | yes | no | — | no |
| src/scripts/_lib/zip_min.ts | 176 | 2 | yes | no | — | yes |

reading: config_chain — a helper with a real intended use (`standards-from-config`
resolves a project's `extends`/`includes` chain through it), but no script exists
yet that invokes it; the skill that needs it is prose-only, and a knowledge-ingest
sibling pipeline (`src/cli/python/knowledge_ingest.ts`) that could plausibly
have grown into its caller instead built its own, unrelated chunking function —
no half-built consumer to finish, only a documented need with nothing reaching
for it. Checked for a real call site before deciding this; found none. Its only
demonstrated value today is what its own test proves.

reading: conformance_report — a design-fidelity dimension scorer (structure /
values / behaviour / responsive / icons / carrier) used correctly by
`tolerance_shadow.test.ts` as a real dependency, but never invoked by a live
design-review script; `design-review`'s own Fidelity-proof chapter names the
need this fills without naming a script that calls it, and no `judge-on-diff`
or bench script reaches for it either. Its only demonstrated value today is
what its own test (plus its legitimate second consumer, `tolerance_shadow`'s
test) proves.

reading: eval_discrimination — pure, dependency-free scoring of an eval's own
negative controls (gross/subtle), built for the archived
`road-to-operator-runtime-harvest` T-003/T-006 one-time parity smoke. That
smoke already ran and its result is captured in
`agents/evidence/cross-model-baseline.md`; there is no recurring pipeline left
to call this again. Its only demonstrated, current value is what its own test
proves — code whose only caller is its own unit test, in substance even though
a second file (the smoke's evidence capture) once read its output by hand.

reading: file_slicer — a deterministic, invariant-checked document slicer
built for `road-to-retrieval-substrate-hardening` B8 (archived). The one live
ingest pipeline in the tree, `src/cli/python/knowledge_ingest.ts`, chunks
documents through its own `chunk_text` instead — a different pipeline than the
one this module was built for, so there is no existing call to extend, only a
parallel implementation already doing the job this one never got to do. Its
only demonstrated value today is what its own test proves.

reading: legacy_boundary_map — a per-path, per-region legacy/modern convention
classifier built for `road-to-consumer-repo-reality` Phase 4 step 4.1
(archived). No script or skill currently calls `classifyPath`/`conventionAt`;
the decision-support role it was built for (telling an editor which convention
governs an edit) has no caller today. Its only demonstrated value today is
what its own test proves.

reading: minimality_tiebreak — the four-criterion tie-break from decision E5
(`road-to-governed-harness-evolution` Phase 4 step 4.5, archived), referenced
by path (not imported) from `tests/scripts/evaluation_vector.test.ts`. The
candidate-selection pipeline E5 was decided for does not exist as runnable
code. Its only demonstrated value today is what its own test proves — the
order is pinned, the arity is pinned, nothing calls it.

reading: overbuild_lens_contract — a dependency-free output-contract parser
and scorer for `overbuild-review-lens`'s own stated grammar; its sibling
fixture directory (`tests/fixtures/overbuild-lens/README.md`) explicitly
documents the split between what this checks mechanically and what still
needs "a scored eval run" the tree does not yet have. This is eval-grading
machinery proven by its own test, not a production runtime component — a
test-carried check that belongs beside its test.

reading: role_split — the analyzer/curator/proposer prompt-builder and
outcome-blind judge contract from `road-to-governed-harness-evolution` Phase 5
step 5.3 (archived). It imports three live `_lib` siblings
(`curator_ops.ts` — reached; `evaluator_promotion.ts`, `judge_hygiene.ts` — not
reached either), but no orchestration script assembling the three-role
pipeline exists in the current tree. Its only demonstrated value today is what
its own test proves.
