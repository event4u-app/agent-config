# py2ts test-layer purge — D1 audit (2026-07-05)

> Phase-0/D1 audit for `road-to-py2ts-teardown-completion.md` (Finish
> strategy 2026-06-29). Classifies the remaining test files that still spawn
> live `python3` via vestigial parity blocks the shim (`tests/_lib/python-free-env.ts`)
> force-skips. `python2ts` is long merged (release 7.5.0, `src` has 0 `.py`),
> so every `python3 <script>.py` parity spawn targets a **deleted** twin and is
> a permanently-skipped no-op today.

## Current surface

- **93** test files spawn live `python3` (`git grep -lE "spawnSync\(['\"]python3?['\"]" -- 'tests/**'`).
- **2** non-vestigial live-python harness sites remain (D2): `src/scripts/lint_regression.ts` (baseline ref may be a pre-migration `.py`) and `src/scripts/parity/replay.ts:212` (`runOnce({command:"python3",...})`).
- Shim still wired: `vitest.config.ts` `setupFiles: ['./tests/_lib/python-free-env.ts']`.

## Classification (the D1 matrix)

Two shapes, distinguished by whether a real (non-parity) `describe` exists
outside the `describe.runIf(hasPython3())(...)` block:

| Tier | Meaning | Action | Count |
|---|---|---|---:|
| **MIXED** | real TS unit tests + a vestigial parity block | **drop the parity block + dead helpers** (zero coverage loss — the TS tests remain) | 4 |
| **PURE-PARITY** | the whole file is the `runIf` parity block; the TS module has **no** other test | **CONVERT** to a python-free intent test (council D1 default — deleting leaves the module untested) | ~79 |
| **HARNESS/helper** | shared python-spawn helpers (`tests/_lib/parity_oracle.ts`, `_bench_*.ts`, `_mcp_server.ts`) — no `describe` | resolve **last**, after their consumers are de-pythonized | 10 |

**No pure-parity file is covered by a sibling test or by `tests/cli/cli-e2e.test.ts`**
(those exercise `versions` / `doctor-shell` / `commands`, not these scripts), so
the council **coverage-degradation guard** forbids blind deletion: sole-coverage
files must be CONVERTed, not deleted.

## Done this wave (MIXED — safe drop)

`confidence_gate`, `events_log`, `modes` (ai_council) + `skills_corpus_grounding_bm25_search`
— removed the `describe.runIf(hasPython3())('… golden parity vs CPython twin')`
block + the now-dead python helpers (`hasPython3`, `py`/`runPy`/`pyAppend`,
`PY_MOD`/`PY_SCRIPT`, the `node:child_process` import). Each stays green
python-free by construction (41 tests total; 0 python residue).

**Recipe (proven, reusable for the remaining MIXED tail if any surfaces):**
1. Delete the parity `describe.runIf(...)` block (title contains "golden parity"/"CPython"/"python3 vs tsx").
2. Delete the python helpers only that block used.
3. Delete now-unused imports (only if `spawnSync` no longer appears).
4. Keep every non-parity test. Verify `vitest run <file>` > 0 tests + 0 python residue.

## Remaining (the CONVERT bulk — delicate, multi-wave)

~79 pure-parity files → convert to python-free intent tests asserting the tsx
module's own contract. **Not a codemod / not a blind snapshot** — each file
must first establish its determinism contract before snapshotting (documented
traps: **PATH**-dependent host-CLI resolution, **float round-half-to-even**,
**relative-time**/wall-clock, seeded-**random** sims, and corpus-over-real-repo
output that bakes the runner's state into the golden → CI-flaky). Use the
`cli/python/workspace_*` recipe: node-only fixture PATH + `norm()` masking +
inline snapshots on pinned inputs.

Coherent next clusters: `_cli/cmd_*` (17, rich `--json`/error-path assertions),
`measure_*` (5, corpus-over-repo — mask/pin), `prediction-pool_*` (3, seeded
random — pin the seed), `inventory_*` (2). Then D2 (the 2 harness sites → local
python-skip guards), then D3 (retire the shim + the 3 scaffolding workflows,
soak ≥24h). Ship as small tests-only PRs per D4 (never touch
`agents/roadmaps-progress.md`; macOS + Linux matrix for snapshot-generating
tests).

## Test-layer speed — final timing note (2026-07-06, `road-to-fast-test-layer`)

The py2ts teardown replaced ~133 python-parity spawns with `tsx`-subprocess
rigs (one `spawnSync(tsx, [script])` per assertion, ~350 ms cold-start each),
pushing the CI Vitest step to **474 s (7m54s)** on ubuntu. Two levers fixed it:

1. **In-process runner** (`tests/_lib/run_in_process.ts`) — `runInProc(main, argv)`
   calls the script's exported `main()` directly (captures stdout/stderr,
   mocks `process.exit`, handles the `ArgparseExit` shapes). Migrated the
   `cmd_*` cluster, the measure/audit/lint/probe rigs, `chat_history`
   (28→1 spawn), `cli_python/{knowledge_ingest,workspace_drive}`, the
   `knowledge_global*` cluster, and `replay_hook`. Skipped: scripts with a
   module-level `os.homedir()` constant (`cmd_update`, `cmd_settings_migrate`,
   `workspace_crypto`) and fixture-copy `check_*` rigs (REPO_ROOT baked from
   `import.meta.url`) — these stay on subprocess.
2. **CI job topology** — CI runners are core-saturated, so single-runner wall
   clock is total-CPU-work ÷ cores; file-level sharding inside one runner
   barely moved it (474→447 s). Split instead:
   - `node-tests`: `--shard=N/4` × 2 OS, **excluding** the two subprocess-heavy
     clusters (they hash-clump into one over-budget shard regardless of shard
     count — a 4-shard run left one bucket at 167 s).
   - `golden-tests`: dedicated job, 6 fork-parallel `golden_replay*` files.
   - `workspace-tests`: dedicated job (`server/workspace` + `cli/python/**`).
     Kept **separate** from golden — combining both oversubscribed the fork
     pool and produced flaky spawn-timeouts.
   - `static-checks`: ESLint + tsc + prepack once (ubuntu-only, OS-independent),
     off the per-shard critical path.

**Result** (run 28769860524, all green): slowest **Vitest step 95 s (1.6 min)**
— every test run back under 2 min (from 7m54s). Slowest **total job 137 s**
(macos node-tests shard 1) is npm-ci + build overhead, not test code; sharding
multiplies that fixed per-job cost, so it is the practical floor. Only required
check `Sync + Generate Tools Consistency` is unaffected by the renamed jobs.
