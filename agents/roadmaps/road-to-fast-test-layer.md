---
status: draft
title: Road to a Fast Test Layer (in-process CLI rigs)
owner: matze4u
---

# Road to a Fast Test Layer

> **Draft** — hidden from the dashboard until flipped to `ready`.

## Problem

The py2ts migration replaced the deleted Python originals with TypeScript
twins and, in doing so, added ~90 CLI-contract test rigs that exercise each
twin by **spawning `tsx <script>` as a subprocess**. `tsx` cold-start is
~300–500 ms per invocation; across thousands of invocations the `Node Tests`
job now runs **~8–11 min** (ubuntu ~10:54), where the pre-migration suite ran
in **1–2 min**.

Two aggravating factors were already addressed on `test/depythonize-remaining-parity-rigs`:

- The rigs used to be `describe.runIf(hasPython3())` / `skipIf(!py3)` — **skipped**
  in the python-free CI (0 s). Depythonizing them un-gated them, so they now run.
- Determinism checks re-ran the twin a second time (2× spawns). **Done:**
  collapsed to a single spawn per case (biggest lever: the `cmd_doctor`
  `expectStable` helper, ~26 call sites).

The remaining cost is the **one** `tsx` cold-start per assertion, across the
whole migrated rig layer — the structural fix below.

## Goal

Restore the `Node Tests` job to ~1–2 min by running the twins **in-process**
(import the exported `main(argv)` / functions, capture stdout/stderr/exit)
instead of spawning `tsx` per assertion.

## Why in-process is safe here

- Most twins export `export function main(argv): number` and set
  `process.exitCode` (never `process.exit()`) — directly callable.
- Vitest runs each **file** in its own fork (`pool: forks`) and tests **within**
  a file sequentially, so a `chdir` + restore (or an injected `cwd`) and
  `process.env` swap in `beforeEach`/`afterEach` do **not** race.
- A shared harness centralises the stdout/stderr capture + exit handling.

## Phase 1 — Harness + pilot

- [ ] Build `tests/_lib/run_in_process.ts`: `runInProc(main, argv, { cwd, env }) → { status, stdout, stderr }` — capture `process.stdout/stderr.write`, snapshot+restore `process.exitCode`, `chdir`+restore, `process.env` overlay+restore.
- [ ] Handle the argparse-error path (some `main`s throw a usage error → map to exit 2) without leaking to the runner.
- [ ] Pilot on one small rig (e.g. `lint_agent_security` or `measure_density`); confirm identical assertions pass and the file's wall-time drops sharply.
- [ ] Decide the fallback for `process.exit()`-using scripts (e.g. `check_condensation`): either refactor the script to return a code from `main`, or keep those few on subprocess.

## Phase 2 — Migrate the cmd_* + check_* + lint_* clusters

- [ ] Replace `spawnSync(tsx, [script, ...args])` with `runInProc(main, args, …)` across the `cmd_*` CLI cluster (biggest count).
- [ ] Migrate the `check_*` / `lint_*` / `audit_*` / `measure_*` rigs.
- [ ] Keep the fixture setup (temp trees, git-init, snapshot/restore) untouched; only the invocation changes.

## Phase 3 — Migrate the heavy multi-case suites

- [ ] `chat_history` (28 spawn sites), `cli_python/*` (23–24), `knowledge_global*` (8–25) — the highest per-file spawn counts.
- [ ] These already import the module for their in-process "Layer 2" blocks; converge the CLI blocks onto the same in-process path.

## Phase 4 — Measure + guard

- [ ] Confirm `Node Tests` wall-time is back to ~1–2 min on both OSes.
- [ ] Add a lightweight guard/budget (e.g. fail if the job exceeds N min) so the regression cannot silently return.
- [ ] Decide whether the `hasPython3`-gated helper tier (`_bench_wave8d`, `_mcp_server`, `parity_oracle` capture-mode) needs the same treatment or stays as-is (already dormant under the shim).

## Non-goals

- Re-introducing Python. The twin is the source of truth.
- Changing what the rigs assert (exit codes, written artefacts, JSON shape) —
  only *how* the twin is invoked.
