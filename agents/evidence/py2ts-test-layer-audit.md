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
