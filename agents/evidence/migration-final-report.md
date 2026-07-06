# Python → TypeScript Migration — Final Quality Report

> Phase 12 Step 5 close-loop of `road-to-typescript-only-scripts.md`
> (archived). Compares the post-migration state on `main` (`c93c0a883`,
> 2026-07-06) against the pre-migration baselines. Data sources are cited
> per section; every number here comes from a fresh tool run or the
> GitHub Actions API, not from memory.

## Verdict

The migration is **complete at parity-or-better on every measured axis**:
zero Python in source, a larger and fully-green test suite, a faster CI
wall clock, zero linter failures (with the warning count driven from 108
to 0 along the way), and every intentional behavior difference recorded
in the divergence ledger.

## 1. Python surface — 955 → 0 (100 %)

Source: `agents/evidence/migration-status.md`, regenerated 2026-07-06 via
`./scripts-run src/scripts/migration_status`.

| Phase | Category | Baseline `.py` | Remaining | % done |
|---|---|---:|---:|---:|
| 2 | libs | 29 | 0 | 100 % |
| 3+11 | installer | 1 | 0 | 100 % |
| 4 | linters | 109 | 0 | 100 % |
| 5 | pipeline | 7 | 0 | 100 % |
| 6 | hooks | 14 | 0 | 100 % |
| 7 | memory-telemetry | 9 | 0 | 100 % |
| 8 | misc | 222 | 0 | 100 % |
| 9 | consumer-templates | 99 | 0 | 100 % |
| 10 | council | 51 | 0 | 100 % |
| 12 | tests | 414 | 0 | 100 % |
| — | **total** | **955** | **0** | **100 %** |

Two tracked `.py` files remain in the repo, both **documented carve-outs
outside the source scope** (`src/`, `tests/`, `agents/`,
`internal/glama`): `internal/bench/ab/fixtures-v2/trapA-overeng-02/src/retry.py`
(bench trap fixture simulating a consumer project file) and
`internal/evals/structure-grounding/fixtures/db/user_model.py` (eval
fixture the structure-grounding eval reads as foreign consumer source).
No `pyproject.toml`, no `conftest.py`, no `.venv*` bootstrap, no
`python3` invocation in taskfiles / workflows / package.json / living
docs (historical records — ADRs, `docs/migration/` — intentionally keep
their provenance wording).

## 2. Test suite — pytest 414 files → vitest 651 files, python-free by construction

- Pre-migration: 414 pytest test files (Phase-1 inventory snapshot,
  2026-06-11).
- Post-migration proof run (2026-07-06, `python-free-env` shim
  **disabled**, real `python3` on PATH): **651 test files, 6608 passed,
  7 skipped, 0 failed** — no test attempts a live python spawn even with
  the runtime present. The 7 skips are capability/opt-in gates (council
  live smoke, node:sqlite, projection presence), not dead parity blocks.
- The migration-era parity apparatus is retired: every live python↔tsx
  parity block was converted to a tsx-only intent test (36 files in the
  final purge alone, 412 tests un-skipped), the snapshot oracle runs
  python-free, and the two remaining live-python harness sites
  (`lint_regression.ts` baseline, `parity/replay.ts`) carry local
  degrade-gracefully guards.

## 3. Linter finding counts — 0 FAIL held, warnings 108 → 0

| Gate | Pre-migration baseline | Current (2026-07-06) |
|---|---|---|
| skill linter | 216 pass / 108 warn / **0 fail** (324 artifacts; `agents/evidence/analysis/lint-baseline-2026-05-09.txt`, Python linter) | 391 pass / 0 warn / **0 fail** (391 artifacts; TS linter) |
| frontmatter schema | (same-shape gate, Python) | 389 artifacts, 0 failing, 0 warnings |
| cross-references | clean | clean (`check_references`: no broken references) |

The artifact universe grew (324 → 391) and the warning count dropped to
zero — both are product growth and deliberate hygiene work that landed
through the normal PR pipeline, not silent linter weakening. The quality
floor the roadmap pinned ("finding counts identical **or improvements
documented**") holds: 0 FAIL on both sides of the migration; the
108-warning cleanup is an improvement, and per-rule behavior changes on
the linter itself are covered by the divergence ledger (§5).

## 4. CI runtime — Tests workflow ~16 % faster despite a larger suite

Source: GitHub Actions API (`gh run list --workflow Tests --branch main`),
wall clock start→end, successful runs only.

| Era | Runs sampled | Wall clock |
|---|---|---|
| Pre-migration (2026-06-10, Python+TS hybrid) | 3 | 5 m 27 s · 5 m 45 s · 5 m 42 s (avg ≈ 5 m 38 s) |
| Post-migration (2026-07-06, TS-only) | 3 | 4 m 23 s · 4 m 45 s · 5 m 00 s (avg ≈ 4 m 43 s) |

Average improvement ≈ 55 s (~16 %) while the executed test count grew
(pytest suite replaced by a strictly larger vitest suite, plus the 412
formerly-skipped parity conversions now running). Sharding (4× per OS)
is unchanged between the eras.

## 5. Divergence ledger — every intentional difference recorded

`docs/migration/divergences/`: **10 documented divergences** (plus
README + template). Each carries symptom, root cause,
bug-fix-vs-regression verdict, and evidence test per the Phase 1
process: bench-stats float precision, mcp-telemetry node:sqlite,
pack-mcp-content gzip body, build_cloud_bundle, check_memory,
inventory_abstraction_budget, lint_marketplace,
lint_mcp_registry_manifest, spotcheck_thin_root,
validate_agent_settings. An undocumented behavior difference is a
regression by definition; none is known.

## 6. Consumer surface

- **Installer e2e**: Install Script Tests (4 shards × ubuntu+macos) and
  Install Aux Tests green in the current Tests runs on `main`; Public
  Install Smoke workflow green (latest 4 runs).
- **Sandbox consumer smoke** (teardown-completion, 2026-07-06,
  tarball-install): compiled `agent-config` CLI green
  (`roadmap:progress` exit 0); single-file skill scripts run via
  `node --experimental-transform-types` once copied out of
  `node_modules`; **known follow-up**: multi-module skill scripts
  (`ground.ts`) need esbuild bundling — tsx is a devDependency and is
  not available in consumer installs (recorded verdict in the archived
  teardown-completion roadmap).

## 7. Remote quality gates on `main` (c93c0a883)

All workflows green: Tests, Consistency (sync + hashes + refs +
portability), Skill Lint, Smoke Contracts, Public Install Smoke, and the
permanent `No Python in src` guard (the migration's structural
regression lock).

## Open follow-ups (tracked outside this roadmap)

1. Delete `tests/_lib/python-free-env.ts` after the disable has soaked
   ≥ 1 CI cycle on `main` (council D3; disable landed in PR #754).
2. esbuild-bundle the multi-module shipped skill scripts (`ground.ts`
   et al.) so consumers can run them node-only.
3. Freeze the `lint_regression` / `parity/replay` baselines to TS
   goldens and drop their live-python paths (council D2 medium-term).
