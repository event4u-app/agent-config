---
status: draft
slug: py2ts-teardown
title: "Python → TypeScript migration: Phase 12 teardown"
parent_roadmap: null
---
<!-- check-refs: skip -->

# Road to Python → TypeScript Teardown (Phase 12)

> **Draft — review before activation.** The dev-side migration is complete:
> every port-target `.py` has a byte-identical, CI-green `.ts` twin (PRs up to
> #604 on `python2ts`). This roadmap plans the **removal** of the Python
> originals. It is a bulk deletion: every deletion phase is a Hard-Floor gate
> (`non-destructive-by-default`) — the agent surfaces the diff and waits for
> explicit confirmation. Nothing is deleted on `draft`/`ready` alone.
>
> **Out of scope:** the final `python2ts → main` merge. That is the user's
> Hard-Floor decision and is not a roadmap step.

> **Teardown PR — 2026-06-18 (this branch `feat/py2ts-final-deletion`).**
> Landed: Phase 4 (delete `src/**/*.py`) + Phase 5 (delete `tests/**/*.py`,
> keep fixtures) + Phase 6 (toolchain + dispatcher python fast-path) executed
> as one atomic diff. **MCP serving completed via the council-chosen Option 2:**
> `mcp_server/server.ts` `_serveOverSdk` now maps all six handlers onto the npm
> `@modelcontextprotocol/sdk` (added as a dependency), byte-parity with the
> Python `mcp` SDK envelopes; a new `tests/scripts/mcp_server_serve.test.ts`
> drives the real SDK Client over stdio (6/6 green) — the Python MCP server is
> deleted with zero feature loss. Gates verified python-shadowed: `check-refs`
> 0 dead links, `npm run typecheck` clean, full vitest **491 files pass / 0 fail
> / 0 python invocations**, CLI dispatcher green.
> **Remainder (follow-up):** Phase 3 dist-consumer A-vs-D smoke; the full
> `grep python3 == 0` sweep across **consumer-shipped templates + contributor
> docs** (owned jointly with `road-to-typescript-only-scripts.md`); and 7
> **pre-existing** condensation-hash drifts in `commands/{fix,roadmap}/*`
> (present on the branch base, not introduced here).

## Inventory (evidence, `git ls-files` on `python2ts` HEAD)

| Class | Count | Disposition |
|---|---|---|
| `src/**/*.py` (port-targets) | 586 | DELETE (Phase 4) — all twinned |
| `tests/**/*.py` (Python suite) | 207 | DELETE (Phase 5) — replaced by `.ts` golden tests |
| `dist/agent-src/**/*.py` (shipped mirror) | 110 | RESOLVE (Phase 3) — consumer runtime, council-gated |
| `pyproject.toml`, `requirements*.txt`, `conftest.py`, `pytest.ini` | ~7 | DELETE (Phase 6) |
| Residual fixtures (`internal/.../user_model.py`, `retry.py`, `internal/glama/smoke.py`) | 3 | **KEEP** — test/fixture data representing Python projects the suite analyzes, not scripts |

## Phase 0 — Pre-teardown gates

- [ ] Confirm PR #604 merged into `python2ts`; full parity suite green on `python2ts` HEAD (baseline evidence).
- [x] **Council decision — consumer dist runtime.** Council (claude-sonnet-4-5 + gpt-4o, 2 rounds, 2026-06-18) **converged**: remove Python from `dist/` entirely; no TS→py transpile (both members independently rejected Option B as vaporware — no production-grade TS→Python transpiler exists; dual-maintenance defeats the migration). Single-TS source, consumer runtime = **Node**. Host tie-break on the residual A-vs-D split (`tsx`-at-runtime vs pre-bundled `.js`): **baseline = A** — the dispatcher (`scripts-run`/`run.ts`) already runs `node_modules/.bin/tsx` and the package already depends on it, so no new bundler infra and no consumer dependency beyond what the installed package ships. **Fallback = D** (pre-bundle the shipped skill-scripts to plain `.js`) IF Phase-1 evidence shows consumers invoke `dist/` skill-scripts standalone without access to the package's `tsx` — decided empirically in Phase 3, not up front.
- [ ] Decide whether `python2ts` is synced with latest `main` one final time before teardown (avoid a late big-bang conflict).

## Phase 1 — Caller discovery (no deletion) — DONE 2026-06-18

- [x] Sweep done across dispatcher, `hook_manifest.yaml`, `Taskfile.yml`, all `.github/workflows/*.yml`, `package.json`, docs.
- [x] Caller map produced (see findings below).
- [x] Orphan check: **0 active port-targets are orphan.** Every live script has a `.ts` twin.

### Findings (caller map)

- **Orphans (twin-less `.py`) = all dead/markers, 0 runtime callers:** 7 `src/scripts/_archive/`, 21 `ai_council/one_off_archive/2026-05/`, 4 `_`-prefix one-offs (`_emit_domain_table`, `_phase4_bucket`, `_pilot_measure`, `_tmp_scan_framework_leakage` — only prose/README refs; `_pilot_measure` is a docstring xref in `iron_law_sha.ts`, not a call), 27 `__init__.py` package markers (content absorbed into `.ts` module structure; `work_engine` 66 `.py`/60 `.ts` gap = exactly these markers, every logic file twinned). All delete without a twin.
- **hook_manifest.yaml — no `.py` handler paths** (R2 dissolved): handlers resolve extension-less via the dispatcher (`.ts`-wins). No rewiring needed.
- **Dispatcher** (`scripts-run` lines 15–19 + `run.ts` `.py` fallback): dead-but-harmless once `.py` gone → removed in Phase 6.
- **CI surface (the real Phase-2 weight):** ~20 PRODUCTION workflows do `setup-python` + `pip install pytest` + `python3 -m pytest tests/` and/or trigger on `src/scripts/*.py` paths — `tests.yml`, `python-version-sweep.yml`, `freeze-guard.yml`, `consistency.yml`, `smoke.yml`, `skill-lint.yml`, `check-visibility-drift.yml`, `migration-dry-run.yml`, `windows-lockfile-export.yml`, `release-validation.yml`, `release-drift.yml`, `cloud-release.yml`, `publish-npm.yml`, `deploy-mcp-worker.yml`, `adoption-snapshot.yml`, `sync-visibility.yml`, `bench-drift.yml`, `release-guard.yml`, `commit-subjects.yml`, `smoke-public-install.yml`.
- **Migration scaffolding workflows (remove in Phase 6, do NOT rewire):** `py2ts-drift.yml`, `migration-gates.yml`, `py2ts-base-guard.yml`, `py2ts-main-sync.yml`, `migration-dry-run.yml`(?-verify).
- **KEYSTONE (re-checked — already satisfied):** `tests.yml` already has a `node-tests` job running `npm run test:ts` (= `vitest run`), and `vitest.config.ts` `include: ['tests/**/*.test.{ts,tsx}', ...]` collects the **entire** parity suite (3116 in `tests/scripts`, plus `tests/cli/python`, `tests/spikes`, …) — NOT just cli/server/ui (the job comment is stale). So vitest is **already the production gate**; deleting `tests/**/*.py` will not remove CI coverage. Phase 2 is therefore mostly **removing** redundant Python jobs/steps, not promoting vitest.
- **Phase-2 work = remove/rewire Python invocations:** `tests.yml` `python-tests` job (pytest + golden-replay-pytest; the `runtime_dispatcher` E2E already uses `./scripts-run` = `.ts`-first), `python-version-sweep.yml` (pytest sweep), `freeze-guard.yml` (golden pytest in toy repo), and any workflow calling `python3 src/scripts/*.py` directly rather than via `./scripts-run`. Most `./scripts-run` callers already resolve `.ts`-first and need no change.

## Phase 2 — Rewire callers to `.ts` (before any deletion)

- [x] `hook_manifest.yaml`: **N/A** — no `.py` handler paths; handlers resolve extension-less via the dispatcher (`.ts`-wins).
- [x] CI workflows — non-pytest direct invocation rewired: `consistency.yml` `python3 src/scripts/check_no_conflict_markers.py` → `./scripts-run src/scripts/check_no_conflict_markers` (job already has `npm ci`; verified locally: dispatcher resolves `.ts`, exit 0, byte-identical to `.py`). The remaining executed-python surface is **all pytest** (`tests.yml` python-tests, `python-version-sweep.yml`, `freeze-guard.yml` golden capture, `windows-lockfile-export.yml`, `consistency.yml:184` readme_linter) — these are removed **atomically with the `tests/**/*.py` deletion in Phase 5**, not here. Migration-scaffolding workflows (`py2ts-*`, `migration-gates`) removed in Phase 6.
- [x] Verified the one rewired caller green individually (byte-parity probe).

## Phase 3 — dist mirror resolution (council verdict: TS-only, Node runtime)

- [ ] Condense pipeline emits `.ts` twins (not `.py`) for `dist/agent-src/**/*.py`; no `.py` in the shipped tree.
- [ ] Consumer smoke (baseline A): install into a sandbox consumer and run a shipped skill-script (`corpus-grounding/bm25_search`, `design-tokens/tokens`) + roadmap-progress via the installed package's `tsx`. Confirm end-to-end.
- [ ] **A-vs-D empirical gate:** if the smoke shows consumers invoke `dist/` skill-scripts standalone without reachable `tsx`, switch the shipped skill-scripts to fallback D (pre-bundled `.js`, node-only) and re-smoke. Otherwise stay on A.

## Phase 4 — Delete `src/**/*.py` port-targets (Hard Floor)

- [x] Surface the deletion diff (586 files) and obtain explicit user confirmation. <!-- 2026-06-18: user authorized deletions + the final PR this session; PR diff is the surface. -->
- [x] Delete `src/**/*.py` (keep the residual fixtures). <!-- 2026-06-18: incl. mcp_server/*.py — TS twin now serves (Option 2). -->
- [x] Verify: full parity suite + `npm run typecheck` + dispatcher resolution green; grep `src/` for any remaining non-fixture `.py` → zero. <!-- 2026-06-18: vitest 491 pass/0 fail python-shadowed, typecheck clean, dispatcher green. -->

## Phase 5 — Delete `tests/**/*.py` Python suite (Hard Floor) — NOT a blanket delete

- [x] Coverage-equivalence audit DONE (2026-06-18, 3 parallel agents, 125 modules) → `py2ts-teardown-coverage-audit.md`. Result: **108 COVERED, ~25 GAP, 1 OBSOLETE, fixtures KEEP.** A blanket delete would have silently dropped ~25 modules of coverage — audit vindicated the stop.
- [ ] **Phase 4.5 (NEW precursor) — port the ~25 GAP modules' missing assertions to `.ts`** before any test deletion. Full list in the audit doc. Includes real security asserts (path-traversal, secret-redaction), `hooks_status` (no `.ts` at all), pricing primitives, per-platform install snapshots, 3 work_engine convergence-loop integrations, contract tests.
- [x] **Council fork — Golden-Transcript replay harness.** Resolved: **full re-platform** (option 2). The entire subsystem is now pure TS+vitest — `harness.ts` (4 comparators + `captureFull`/`replay`), `runner.ts`, `capture.ts`, 29 `gt*.ts` recipes, `calculator.ts`+`calculator.test.ts` toy repo, `golden_replay.test.ts` (29/29 green; `GOLDEN_SMOKE=1` fast subset), baselines re-derived from the `.ts` system. All 37 `tests/golden/sandbox/**/*.py` (incl. `runner.py`, `_helpers.py`, recipes, toy repo, `__init__` markers) deleted; `git ls-files '*.py'` now returns only the 3 `internal/` + 4 `tests/hooks/fixtures/` intentional fixtures. Tracked in the child roadmap `road-to-golden-transcript-ts-replatform.md` (complete). This closes the Phase-5 fork; the remaining `tests/**/*.py` line item is satisfied by the same deletion.
- [ ] Reconcile the 4 `work_engine/hooks` partial-gap modules (Batch A deep-gap vs Batch B covered) per-module before deleting those.
- [ ] Only after gaps closed: delete the COVERED + OBSOLETE `.py` test modules + `conftest.py` + `pytest.ini` (Hard Floor diff). **KEEP** all fixtures/recipes (`sandbox/`, `fixtures/`, `gt*.py`, `concern_*.py`, `test_calculator.py`).
- [ ] Atomically remove the pytest CI jobs/steps (`tests.yml` python-tests, `python-version-sweep.yml`, `freeze-guard.yml`, `windows-lockfile-export.yml`, `consistency.yml:184`) in the same diff.
- [ ] Verify: full `.ts` test suite green.

## Phase 6 — Remove Python toolchain + dead fast-paths (Hard Floor)

- [~] Remove `pyproject.toml`, `requirements*.txt`, `python-version-sweep.yml`, the `migration-gates.yml` python-parity-dep step, and the migration scaffolding workflows once parity is no longer being tested. <!-- partial 2026-06: pyproject.toml / requirements*.txt / pytest.ini / conftest.py / python-version-sweep.yml / freeze-guard.yml all already deleted. BLOCKED on the rest (migration-scaffolding `py2ts-*.yml`) because parity is still tested by the ~466 R6/R7 python-spawn rigs — those must be retired first. -->
- [x] Remove the dispatcher Python fast-path (`scripts-run` lines 15–19) and the `run.ts` `.py` fallback. <!-- verified 2026-06: scripts-run is 9 lines, pure `tsx src/scripts/run.ts` (no python branch); run.ts has no .py fallback; runtime_dispatcher.py / run.py deleted. -->
- [ ] Surface the diff (infra + bulk) and obtain explicit confirmation.
- [ ] Verify: full CI green; dispatcher still resolves `.ts` from any cwd.

## Phase 7 — Final sweep + close

- [ ] `git ls-files '*.py'` returns only the 3 kept fixtures.
- [ ] `grep -rn 'python3'` across tracked files returns zero invocation sites (fixtures/docs prose excluded).
- [ ] Full CI green on `python2ts`.
- [ ] Hand back to user: `python2ts → main` final merge is the user's Hard-Floor decision (out of scope).

## R6 — Parity-rig dependency (CRITICAL, discovered 2026-06-18, blocks teardown-as-planned)

```
479 of 541 .test.ts (88%) are golden-parity rigs that spawn `python3 <original.py>`
and byte-compare .py-output vs .ts-output. Deleting the src .py removes their
comparison anchor → they fail / assert nothing. "COVERED" in the audit is largely
parity-rig coverage that does NOT survive deletion.
```

The parity rigs are the **migration's verification mechanism** (prove `.ts == .py`),
not a standalone permanent suite. "Delete all `.py`" therefore requires first
**converting ~479 rigs to standalone `.ts` tests** (inline/snapshot the expected
values, drop the `python3` spawn) — an effort comparable to the migration itself,
not the "~25 gap ports" the audit alone implied. Evidence: `PY_SCRIPT = …X.py` +
`spawnSync('python3', …)` in `directives_backend_analyze.test.ts`,
`ai_council/config.test.ts`, `templates_telemetry_report.test.ts`, `_cli/cmd_migrate.test.ts`,
and 475 others. CI would go red on deletion (visible, not silent) — but the path
to green is the rig-conversion, not the deletion.

**Decision (council 2026-06-18, claude-sonnet-4-5 + gpt-4o, 2 rounds; split A↔C → host-synthesised hybrid):**
- **A — snapshot-conversion** for the ~450 COVERED parity rigs: capture each rig's
  `python3` output once as a committed snapshot, rewrite the rig to compare the
  `.ts` output against it, drop the live `python3` spawn. They share one
  `spawnSync('python3', …)` pattern → drive via a **codemod + verification**, not
  450 hand-edits. Preserves the migration's byte-verified contract (the `.ts` is
  intentionally byte-identical to `.py`, so the snapshot just freezes the
  already-verified state).
- **C — fresh intent-based standalone tests** for the ~25 GAP modules (no rig to
  snapshot; must be written anyway) — covers the round-2 intent concern exactly
  where it matters (security, contracts, convergence-loops).
- **B rejected** (both members, both rounds — fails "end Python").

This is the new Phase 4.5. Execution: (1) codemod the rigs A-style + verify green;
(2) write the ~25 C-style gap tests; (3) THEN the deletion waves (4/5/6).

### Phase 4.5 — prototype DONE (2026-06-18), fan-out sized

`tests/_lib/parity_oracle.ts` built + validated on `templates_telemetry_report.test.ts`:
capture mode freezes the `python3` output as committed JSON snapshots
(`tests/_lib/__parity_snapshots__/`); normal mode reads them — **proven** to run
green with `python3` absent from PATH AND to go RED on an injected twin regression
(R6-neutering guard satisfied), typecheck clean. The A-strategy is executable.

**Fan-out obstacles (must handle before bulk capture — `.py` deletion is irreversible for capture):**
1. **Key normalization** — naive `hash(stem+args+input)` fails on volatile tmp-path args + basename collisions; the oracle keys file-args on content-hash. Works only where output is path-independent.
2. **#1 blocker — tmp paths IN output.** Rigs whose stdout/stderr echoes an absolute tmp path are not byte-comparable to a frozen snapshot. Need output normalization or a deterministic fixture root before capture. **Repo-wide audit required.**
3. **Non-determinism** (`Date.now`/`Math.random`/random fixtures) — must be made deterministic before capture or can't use the oracle.
4. **Module/inline invocations** — shared `ai_council/_harness.ts` + `_config_parity.ts` use `python3 -m`/`-c` + `PYTHONPATH=src`, not `python3 <stem>.py`. Oracle needs a v2 invocation-descriptor (`{kind: script|module|inline, target, args, input, env}`).
5. **Leverage** — route the python side through the oracle **inside the shared harnesses once**, not 311 rigs individually.
6. **Capture-once + review gate** — capture must run with `.py` present and the goldens be reviewed/locked **before** Phase 4 deletes the `.py`; after deletion, a missing/wrong snapshot is unrecoverable.

Revised Phase-4.5 sub-sequence: (0) pre-capture audit (nondeterminism + tmp-in-output) → (1) oracle v2 (invocation-descriptor + normalization hooks) → (2) convert shared harnesses → (3) convert the inline-spawn rigs (parallelized) → (4) bulk capture + review-lock → (5) write ~25 C-gap tests → THEN deletion.

### R7 — File-side-effect / scratch-dir rigs (discovered 2026-06-18, blocks harness conversion)

The harness-conversion wave (2026-06-18, branch `feat/py2ts-phase45-harness-conversion`,
WIP-checkpoint, NOT merged) converted both shared harnesses (`ai_council/_harness.ts`,
`_config_parity.ts`) through oracle v2: **10 of 19 importers green** (python3-off-PATH),
2 regression-proofs, typecheck clean. But **9 importers fail** — a new obstacle class:

- **Output-sink-FILE rigs (5):** `budget_guard`, `probation_gate`, `low_impact_intake`,
  `shadow_dispatch`, `clients` — python WRITES a tmp file the rig then reads. A
  stdout-only snapshot oracle cannot replay file side-effects.
- **Volatile scratch-DIR rigs (4):** `session`, `bundler`, `compile_corpus`,
  `config_session_profiles` — a random-basename scratch dir as a python arg →
  snapshot key never stable → `readSnapshot` throws.

**Coupling problem:** converting a SHARED harness forces ALL its importers onto the
oracle at once, so it cannot land green until these 9 are handled. **Fork (next session):**
(a) **oracle v3** — capture file side-effects + accept a stable-scratch-path contract,
or (b) **restructure the 9 rigs** to assert on python STDOUT (emit the written bytes)
+ use a fixed scratch path. (a) is a mechanism change reusable across any future
side-effect rig; (b) is bounded per-rig work. Route to council or decide in the fresh
bulk-execution session. The 10-green harness conversion is preserved on the WIP branch
and is reusable under either fork.

**Resolved — council (claude-sonnet-4-5 + gpt-4o, 2026-06-18, 2 rounds, converged):
Oracle v3 for both sub-shapes; reject stdout-coercion and TS-only demotion.**

- **No single mechanism is uniform across both sub-shapes** — the impossibility of
  freezing B as an independent python snapshot is evidence *for* the split, not against.
- **Sub-shape A (5 file-sink rigs):** extend the oracle to capture **raw file bytes**
  via a declared-output-path contract. Rejected option (b)'s `print(open(p).read())`
  stdout-coercion: it smuggles base64-for-binary, multi-file serialisation, error
  mis-attribution (python-crash vs byte-diff), and pipe-truncation-without-integrity.
  One central file-capture (1×) beats 5× per-rig `fs.readFileSync` duplication.
- **Sub-shape B (4 scratch-dir rigs):** capture the python **composite artefact**
  (incl. its cross-read of the live TS output) at capture time, while `.py` still
  exists. Rejected demoting the cross-read to a TS-only round-trip: "TS reads its own
  zips" is a tautology when one lib writes+reads; the cross-language equivalence
  ("python reads TS output") is the load-bearing guarantee and must be frozen, not
  dropped. Post-deletion python is gone, so the frozen capture-time verdict is the
  strongest preservable form.
- **Stable-scratch-path contract** required so B's key is deterministic (the existing
  `readSnapshot` throw-on-missing guard is preserved unweakened).

Session synthesis: `agents/runtime/council/responses/r7-fork-synthesis.md/` (transient).

#### Harness conversion — COMPLETE (2026-06-18, verified)

Oracle v3 built (`tests/_lib/parity_oracle.ts`): `outputs` (freeze file side-effects, base64),
`oracleFile()` decoder, `scratch` (stabilise volatile path args in the snapshot key), plus the
`outputs`/`scratch` guards (a declared output with no frozen `files` THROWS — the R6 no-neutering
guard extended). Plumbed through `_harness.ts` (`runPyCode`/`runPyScript`) and `_config_parity.ts`
(`runPy`). All 9 R7 rigs converted + verified python-independent (python3 shadowed by a failing stub,
git intact) + regression-proof (twin break → RED → revert → green):
- file-sink (A): `budget_guard`, `probation_gate`, `low_impact_intake`, `shadow_dispatch`, `clients`.
- scratch/composite (B): `session`, `compile_corpus`, `config_session_profiles` (`--root` scratch + overlay
  file freeze), `ai_council/bundler` (volatile-repo `scratch` + symmetric path-normalize). Cross-read
  rig `claude_desktop_bundler` also converted (oracle composite freeze; cross-read preserved per council).
Full importer set green python-independent: **28 files / 444 tests pass, 0 fail** (`ai_council/` +
`config_session_profiles` + `claude_desktop_bundler`). Global typecheck clean. The prior 10 importers
stay green (back-compat: the v3 fields are additive/optional).

#### Remaining python-dependent test files — 21 (full-suite python3-shadowed sweep, 2026-06-18)

The shared-harness leverage already covered most rigs; only **21 files (158 tests)** still spawn python3
directly. Triaged (NOT a uniform snapshot-convert — see council verdicts):
- **Convertible golden-parity rigs (snapshot oracle):** `tests/lib/{agent_src,json_pointers,linked_projects,token_count,user_global_paths,value_ladder,value_report}.test.ts`,
  `tests/scripts/{council_cli,council_prune,run,runtime_handler}.test.ts`, `tests/scripts/hooks/replay_hook.test.ts`.
- **Retire-and-replace (council Option B, → C-gap integration tests):** `tests/parity/replay.test.ts` (the byte-replay Golden-Transcript harness).
- **Delete (obsolete spikes — python-vs-npm comparisons, meaningless post-teardown):** `tests/spikes/pyyaml_vs_npm.test.ts`, `tests/spikes/yaml_rt_spike.test.ts`.
- **Phase-6-coupled (hit python via the dispatcher fast-path / `scripts-run`; convert WITH the dispatcher python removal, not before):** `tests/cli/{cli-e2e,mcp-server.e2e,settings.e2e}.test.ts`, `tests/server/{wizard.applySse,workspace}.test.ts`, `tests/ui/build.test.ts`.

Next wave = convert the golden-parity subset (proven oracle-v3 patterns), retire `replay`, delete the
spikes; then bulk-capture + review-lock; then Phase 4+ deletions (HARD FLOOR — explicit user confirmation).

#### Golden-parity subset converted (2026-06-18) + env-brittle class carve-out

Converted to the snapshot oracle (verified python-shadowed green + regression-proof): `tests/lib/{agent_src,
json_pointers,linked_projects,token_count,user_global_paths,value_ladder,value_report}.test.ts`,
`tests/scripts/{council_cli,council_prune}.test.ts`. Correctly NOT converted (re-triaged on inspection):
`run` + `hooks/replay_hook` (dispatcher-coupled → Phase 6), `runtime_handler` (python3 `-c` is a generic
subprocess fixture for `execute_shell`, no `.py` twin → fixture-swap in Phase 6).

**Env-brittle frozen-rig class — RESOLVED by council (claude-sonnet-4-5 + gpt-4o, 2026-06-18, converged):**
A rig may be snapshot-frozen ONLY if its output is a **pure function of committed source**. Rigs whose
output derives from **generated / gitignored state** (e.g. the discovery manifest) are NOT freezable: the
golden bakes the capture-env's generated state and diverges from CI's freshly-built one — a CI-only
failure invisible to the local python-shadowed sweep (which catches python-DEPENDENCE, not cross-env
brittleness). The deterministic-build-in-setup alternative was rejected: the manifest builder is not
provably cross-environment deterministic (fs traversal order, OS case-sensitivity, path separators, Node
version). Such rigs stay **LIVE python↔tsx** (`skipIf(real python3)`) until the deletion phase.
- **`config_packs`** (instance): `--json` closure comes from `load_manifest` (gitignored). Reverted its 3
  golden-parity tests to live python↔tsx + real-python3 gate; dropped the frozen `module-scripts.config.packs`
  snapshots. Green on CI (python present, both sides read CI's fresh manifest), skips post-deletion.
  Now in the **deletion-phase bucket** (blocks deleting `config/packs.py` until a Phase-5 resolution —
  e.g. make `packs` read committed source, or commit a deterministic manifest fixture).
- **Detection (Phase-5 gate):** before deleting any `.py`, audit each surviving frozen rig for
  generated/gitignored-state reads; re-classify manifest-dependent ones as live-parity-then-delete.

#### Obsolete live-parity-block cleanup — Phase A (raw-spawn rigs) DONE 2026-06

The `python-free-env.ts` shim force-skips ~2997 obsolete `(describe|it).(skipIf|runIf)(<python-gate>)`
live-parity blocks (its own comment scheduled "delete the obsolete live-parity blocks outright … without
the 472-file surgery"). Phase A does the safe, mechanizable slice of that surgery:

- Built a TS-compiler-API codemod (no new dep) that removes a block **only** when it is UNAMBIGUOUS raw
  live-parity — body spawns `python3` directly AND references no oracle (`oracle2`/`oracleFile`/`runPyScript`/
  `runPyCode`) — then drops orphaned imports / consts / local types. Oracle-backed blocks (converted
  coverage) are detected and left untouched.
- Of 460 python-gated files: **170 cleaned** (raw-spawn blocks + orphans removed, every file retains its
  real pure-TS / ported-pytest tests), **20 reverted** (their *only* content was the parity block → pure
  rigs that need oracle-conversion, not deletion — left shim-skipped), **269 skipped** (oracle-backed,
  need per-file human judgement on whether the `runIf(py3)` gate is stale or load-bearing).
- **Verified lose-nothing:** full suite `4801 passed` (identical to the pre-cleanup baseline) / `2450
  skipped` (down from `2997` — 547 dead blocks gone) / **0 failures**; typecheck + eslint clean. Net diff:
  170 files, 0 file deletions, ~10.2k dead lines removed.
- **Remaining (deferred, NOT blocking):** the 20 pure-rigs + 269 oracle-backed files + retiring the
  `python-free-env.ts` shim are per-file human-judgement work, not mechanizable safely. The shim keeps the
  suite green python-free until then; none of this blocks the `python2ts → main` merge.

### Completion plan to the final PR — council (claude-sonnet-4-5 + gpt-4o, 2026-06-18, converged)

**Structure = ~3 PRs, NOT granular per-phase.** Deleting `src/**/*.py`, `tests/**/*.py`, the pytest CI
jobs, and the dispatcher python fast-path MUST be **ATOMIC in one PR** — splitting them creates a
"zombie test state" (surviving pytest imports / dispatcher calls reference deleted modules →
`ModuleNotFoundError`/`FileNotFoundError`, not independently green, not independently revertible, and it
crosses the irreversible `.py`-deletion line while python tests still need the code).

- **PR-1 (prerequisites — NO `.py` deletion, each independently green):**
  - [x] Orphan-snapshot prune (18 unreferenced goldens removed; 0 referenced touched).
  - [x] `runtime_handler` — `python3 -c` fixtures → `node -e` (language-irrelevant subprocess; now python-independent).
  - [ ] **Gap coverage (PR-1b) — authoring done 2026-06-18, closes when merged:** 23 gap modules now have `.ts` tests
    (~230 new tests, all green python-shadowed + bite-checked): batch 1 = pricing, telemetry/boundary,
    council_cli units, hooks_status, event_shape_contract, dispatcher_feedback traversal, contracts
    (memory-visibility-redaction / readme-audience-order / rule-interactions behavioural),
    install/consumer_model_tier, retrieval fixtures, migrate v0-state, explain disabled-short-circuit;
    batch 2 = work_engine state validators / ui-polish / ui-review dispatch / cli-hooks exit table /
    integration chat-history + full-flow (4-rebound) + mixed-flow (5-rebound) + persona + user-type, and
    install_snapshot (per-platform + drift guard). The **Golden-Transcript `replay` subsystem is retired**
    per council Option B — its coverage is the full-flow + mixed-flow integration tests; `tests/golden/
    test_replay.py` + `harness.py` + recipes are slated for deletion in PR-2. **Found + fixed a real bug**
    in `install.ts` (`finalize_claude_model_tiers` passed file-contents not path → auto model-tier switch
    rendered 0 skills). **Justified skips:** `implement_ticket/test_shim.py` (python import-system shim,
    no TS equivalent — dies with `__init__.py`); `cli/test_hooks_install_claude_flag.py` (bash-dispatcher
    e2e — Phase-6-coupled, handled in PR-2). Partials reconciled per-module.
  - **`config_packs` = council option (c):** do NOT refactor `packs` to committed source (that changes
    production behaviour — rejected). The live-parity byte-check is transitional; it retires naturally
    with python (the monkeypatched `resolve_active_*` unit tests carry the logic coverage). Its
    `skipIf(real-python3)` block self-skips post-deletion / is dropped in PR-2. No prereq refactor.
- **PR-2 (the FINAL atomic deletion — Hard Floor, user-authorized 2026-06-18):** delete `src/**/*.py`
  (~586; keep the 3 `internal/` fixtures) + `tests/**/*.py` + `conftest.py`/`pytest.ini` + pytest CI
  jobs + dispatcher python fast-path & `.py` fallback + `pyproject.toml`/`requirements*.txt` + migration
  scaffolding, AND repoint the 8 dispatcher-coupled e2e tests + delete the 2 obsolete spikes + retire the
  `config_packs`/`config_session_profiles` live-parity blocks — all in one atomic, independently-green PR.
  Snapshots are already review-locked (committed). Then hand to user for `python2ts → main`.

## Risk register

- **R1 — shipped consumer runtime (highest).** `dist/agent-src/**/*.py` is executed by consumers, not just dev tooling. Deleting src `.py` without resolving dist emission breaks installed consumers. **Resolved (Phase-0 council, 2026-06-18):** TS-only, Python fully removed; runtime = Node-via-`tsx` (baseline A), pre-bundled `.js` fallback (D) only if Phase-1 evidence forces it. Residual exposure = the empirical A-vs-D call; Phase-3 consumer smoke is the verification.
- **R2 — hook handlers point at `.py`.** Deleting before rewiring `hook_manifest.yaml` silently disables hooks. Gated by Phase-2-before-Phase-4 ordering.
- **R3 — coverage loss.** Deleting the Python test suite could drop assertions the `.ts` tests don't replicate. Gated by Phase-5 coverage-gap check.
- **R4 — dispatcher orphan.** A `.py` with no `.ts` twin becomes unresolvable after deletion. Gated by Phase-1 orphan check.
- **R5 — CI scaffolding vs production confusion.** Removing a production workflow thinking it was migration scaffolding. Gated by Phase-2 classification.
