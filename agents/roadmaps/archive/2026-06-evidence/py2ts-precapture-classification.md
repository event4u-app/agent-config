# Phase-4.5 Pre-Capture Classification (2026-06-18)

Companion to `road-to-py2ts-teardown.md`. Three parallel read-only audits
classified all **423** python3-spawning `.test.ts` rigs (the conversion surface)
so the snapshot-oracle fan-out handles each rig's shape correctly. Heuristic
(grep + spot-read); the `needs-review` sets are conservative supersets.

## Invocation kind (drives oracle-v2 scope)

| kind | ~count | oracle support |
|---|---|---|
| `script` — `python3 <stem>.py` | ~260 | oracle v1 (prototype) already handles |
| `inline` — `python3 -c "<code>"` | ~124 | **needs v2 descriptor** |
| `module` — `python3 -m <mod>` + `PYTHONPATH` | ~7 | **needs v2 descriptor** |
| `mixed` (more than one) | ~29 | **needs v2 descriptor** |

→ **~160 rigs (38%) need oracle v2** with an invocation descriptor
`{kind: script|module|inline, target, args, input, env}`. The prototype oracle
only models `script`.

## Shared harnesses (convert ONCE → cover many rigs)

- `tests/scripts/ai_council/_harness.ts` — exports `hasPython3/runPyScript/runTsScript`; **16 importers**. Route its python side through the oracle once → 16 rigs converted.
- `tests/scripts/_config_parity.ts` — exports `runPy/runTsx`; **5 importers** (`config_packs`, `config_session_profiles`, `config_profile_explain`, `config_presets`, `config_profiles`).

The other ~400 rigs inline their own `spawnSync`/`runPy` — converted per-file (parallelizable), but the pattern is uniform.

## Special handling BEFORE bulk capture

### Nondeterministic OUTPUT — must freeze the clock before capture (~4)

- `tests/scripts/adoption_report.test.ts` — live `new Date()`/`toISOString()` written into fixtures AND asserted as `nowDay` in output.
- `tests/scripts/check_proposal.test.ts` — live `today=new Date()` baked into fixture frontmatter, byte-compared.
- `tests/scripts/cli/python/workspace_explain.test.ts` — live-clock relative-time (already masked in-test; port the mask into the oracle).
- `tests/scripts/cli/python/workspace_drive_health.test.ts` — py `time.time()` vs TS `Date.now()` diverge run-to-run (inline comment flags it); neutralize time AND path.

(Many raw `Date`/`random` hits are NOT output-affecting — fixed `Date.UTC()` clocks, temp-filename-only randomness, seeded RNG — and convert cleanly.)

### tmp-path-in-OUTPUT — needs path normalization before capture (~35)

Rigs that use a tmpdir AND assert on stdout/stderr that may echo the absolute
path. Many already carry a `norm([tmp])` stripper or `<TMP>` mask (reuse it);
the rest need one added. Full list (conservative superset) across batches:
`install_regenerator`, `cmd_settings_migrate`, `cmd_versions`, `check_council_layout`,
`check_memory_proposal`, `hooks/replay_hook`, `lint_command_tiers`, `lint_global_paths`,
`lint_one_off_age`, `lint_showcase_sessions`, `lint_workspace_boundary`, `pattern_share`,
`skill_trigger_eval`, `sync_gitignore`, `templates_tier_usage_report`, `check_proposal`,
`check_trigger_evals`, `lint_marketplace`, `cmd_doctor`, `cmd_uninstall`, `cmd_validate`,
`adoption_snapshot`, `bench_rtk_savings`, `build_discovery_manifest`, `check_artefact_checksums`,
`workspace_drive_health`, `workspace_inbox`, `knowledge_ingest`, `evidence_report`,
`hooks/dispatch_issues`, `lint_agent_security`, `pack_mcp_content`, `release`, `router_telemetry`,
`skill_usage_report`.

**Key-normalization (already in prototype):** file-args are keyed on content-hash
so volatile tmp-path args don't break snapshot lookup. The remaining risk is tmp
paths in the OUTPUT, handled by the per-rig normalizers above.

## Revised fan-out sequence

1. **Oracle v2** — invocation descriptor (script/module/inline) + a per-rig output-normalization hook + clock-injection support. Validate on one rig per kind.
2. **Convert the 2 shared harnesses** through v2 → 21 rigs.
3. **Convert the ~400 inline-spawn rigs** (parallelized subagent batches), applying normalizers to the ~35 tmp-risk + clock-freeze to the ~4.
4. **Bulk capture** (`PY2TS_CAPTURE=1`, `.py` present) + **review-lock** the snapshots — the irreversible gate before deletion.
5. Write the ~25 C-style gap tests (audit doc).
6. Deletion waves 4/5/6 (Hard Floor).
