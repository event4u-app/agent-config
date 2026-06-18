# Agent Handoff — Python→TypeScript Teardown (Phase 12 / 4.5)

Paste-ready state dump for a fresh session. Everything below is committed/pushed;
this branch is the resume point.

## Mission (standing mandate — still in force)

Replace ALL Python scripts in `event4u/agent-config` with byte-identical TypeScript
twins, then REMOVE the Python originals. Prime directive, verbatim: **"nichts
verlieren, keine Qualität einbüßen"** (lose nothing, no quality regression).

- **Branch model (locked):** integration branch is `python2ts`. EVERY migration PR
  targets `python2ts`, NEVER `main`. The final `python2ts → main` merge is the
  USER's decision (Hard Floor) — never autonomous.
- **Design decisions → AI council** (`python3 src/scripts/council_cli.py debate <q> --prompt-mode design --output <o> --rounds 2 --auto-continue --confirm`). Config is user-global, enabled, members claude-sonnet-4-5 + gpt-4o.
- **Work happens in worktree** `.claude/worktrees/py2ts-phase1` (on `python2ts` base).
- **Bulk deletion (Phases 4/5/6) = Hard Floor** — surface the diff, get explicit user confirm before the commit. Autonomous mandate does NOT lift this.

## The dev-side migration is COMPLETE

Every port-target `.py` has a byte-identical, CI-green `.ts` twin (PRs up to #604,
all merged). This session was about **Phase 12 — removing the Python originals.**

## What this session delivered (all merged unless noted)

| PR | Content | State |
|---|---|---|
| #605 | Teardown plan-of-record + Phase 0-2 (council R1, caller discovery, CI rewire of the one direct `python3` call) + coverage audit + R6 + strategy | merged |
| #606 | Oracle v1 prototype (`tests/_lib/parity_oracle.ts`) — validated, regression-proof | merged |
| #607 | Pre-capture classification of 423 rigs | merged |
| #608 | Oracle v2 (`oracle2({kind:script\|inline\|module,...})`) | merged |
| — | Harness conversion 10/19 | **WIP branch `feat/py2ts-phase45-harness-conversion`, NO PR, blocked on R7** |

`python2ts` HEAD after #608 = `c696d32d`. Read these committed docs FIRST (they hold the durable detail):
- `agents/roadmaps/road-to-py2ts-teardown.md` — the master plan + R1–R7 risk register.
- `agents/roadmaps/py2ts-teardown-coverage-audit.md` — which `.py` tests survive deletion; the ~25 GAP modules needing C-style intent tests.
- `agents/roadmaps/py2ts-precapture-classification.md` — per-kind invocation map, the ~35 tmp-normalize list, the ~4 clock-freeze list, harness leverage.

## Council verdicts (do NOT relitigate)

1. **dist consumer runtime (R1):** TS-only; remove Python from `dist/` entirely; consumer runtime = Node. Baseline A = run via `tsx` (dispatcher already does); fallback D = pre-bundled `.js` only if Phase-3 smoke shows consumers invoke dist skill-scripts without `tsx`. No TS→py transpile (vaporware).
2. **Golden-Transcript harness:** Option B — retire the byte-replay harness; replace with targeted `.ts` integration tests for the 3 multi-rebound flows (these are 3 of the ~25 gaps).
3. **Rig-teardown strategy (R6):** Hybrid — **A snapshot-conversion** for the ~450 COVERED parity rigs (preserves the byte-verified contract); **C fresh intent tests** for the ~25 GAP modules; B (keep .py as oracles) rejected.

## The KEY findings that shaped everything

- **R6:** 479 of 541 `.test.ts` (88%) are golden-parity rigs that spawn `python3 <original>.py` and byte-compare vs the `.ts` twin. Deleting the `.py` removes their anchor → they break. So "delete all .py" requires first converting them to a snapshot-oracle. This is migration-sized.
- **R7 (the current blocker):** 9 rigs can't use the stdout-only oracle — they give python an output-sink file or random scratch dir. Named:
  - file-sink (5): `budget_guard`, `probation_gate`, `low_impact_intake`, `shadow_dispatch`, `clients`
  - scratch-dir (4): `session`, `bundler`, `compile_corpus`, `config_session_profiles`
  - Shared-harness conversion is all-or-nothing per harness → these 9 block landing the harness conversion green.

## IMMEDIATE NEXT DECISION — R7 fork

(a) **Oracle v3** — extend `parity_oracle.ts` to capture file side-effects + accept a
stable-scratch-path contract (mechanism change, reusable for any side-effect rig); or
(b) **Restructure the 9 rigs** to assert on python STDOUT (emit written bytes) + use a
fixed scratch path (bounded per-rig).
→ Route to council or decide directly, THEN finish the harness conversion green.

## The snapshot-oracle mechanism (already built, on python2ts via #606/#608)

`tests/_lib/parity_oracle.ts`:
- `oracle(stem, args, input)` — v1 script wrapper.
- `oracle2({kind:'script'|'inline'|'module', target, args?, input?, env?, normalize?, cwd?})` — v2.
  - `script`: `python3 <target>.py args`; `inline`: `python3 -c <target>`; `module`: `python3 -m <target>` + PYTHONPATH via `env`.
  - CAPTURE mode (`PY2TS_CAPTURE=1`, `.py` present): runs python3, freezes `{stdout,stderr,status}` JSON under `tests/_lib/__parity_snapshots__/`.
  - NORMAL mode: reads snapshot; **missing snapshot THROWS** (never silent-skip — this is the R6 no-neutering guard).
  - `normalize` hook strips tmp/clock noise symmetrically on capture + read; the rig's `.ts` side must apply the SAME fn.
- Conversion pattern: replace the rig's `python3` spawn with an `oracle2(...)` call; keep the `tsx` spawn of the real `.ts` twin + the assertions unchanged.

## Resume sequence (Phase 4.5 remaining, then deletion)

1. Decide R7 fork → finish harness conversion green (resume from WIP branch `feat/py2ts-phase45-harness-conversion`, which has 10/19 done).
2. Convert the ~400 inline-spawn rigs (parallelize via subagents, ~40-60 per batch like the audits). Apply the ~35 normalizers + ~4 clock-freezes from the classification doc.
3. **Bulk capture** (`PY2TS_CAPTURE=1`, `.py` present) + **review-lock** the snapshots — irreversible gate; capture is impossible after `.py` deletion.
4. Write the ~25 C-style intent gap tests (list in coverage-audit doc; includes the 3 golden-flow integrations).
5. **Phase 4 (Hard Floor):** delete `src/**/*.py` (586; keep the 3 `internal/` fixtures). Re-condense (dist `.py` auto-disappears — condense is extension-agnostic). Verify vitest + typecheck + dispatcher green.
6. **Phase 5 (Hard Floor):** delete `tests/**/*.py` COVERED+OBSOLETE modules + `conftest.py`/`pytest.ini`; KEEP fixtures (`sandbox/`, recipes `gt*.py`, `concern_*.py`, `test_calculator.py`). Atomically remove the pytest CI jobs (`tests.yml` python-tests, `python-version-sweep.yml`, `freeze-guard.yml`, `windows-lockfile-export.yml`, `consistency.yml:184`).
7. **Phase 6 (Hard Floor):** remove `pyproject.toml`, `requirements*.txt`, dispatcher Python fast-path (`scripts-run` lines 15-19) + `run.ts` `.py` fallback, migration scaffolding workflows (`py2ts-*`, `migration-gates`).
8. Hand back: `python2ts → main` is the user's call.

## Technical gotchas / environment

- **npx is BROKEN here (ELOOP).** Use `node node_modules/.bin/tsx`, `node node_modules/vitest/vitest.mjs`, `npm run typecheck`.
- Package is `"type":"module"` — no bare `require` (throws under tsx); use top-level `import` or `createRequire(import.meta.url)`.
- Verify python-independence: run a converted rig with `PATH="$(dirname $(command -v node)):/usr/bin:/bin"` (python3 off PATH) → must pass.
- Each wave: branch off `origin/python2ts`, commit `--no-verify`, push, `gh pr create --base python2ts`, watch CI green, wait for user "gemerged, mach weiter".
- Commit-state baseline tests (condense ZERO-drift, backfill, generate_catalog) need a CLEAN tree — commit before running them.
- Context-hygiene: the bulk waves are quality-critical; run per-batch conversion via FRESH subagents (each gets clean context), orchestrate + verify from the main loop, don't grind one mega-context.
- ADR for the migration is reserved at **ADR-200**.

## Verification before any "done" claim

Fresh evidence in-message: the converted rig(s) green via vitest (python3 off PATH for python-independence proof) + `npm run typecheck` clean + regression-catch proof (inject a twin change → test goes RED → revert → green). A green CI that asserts nothing (silent neutering) is the worst outcome — the missing-snapshot-throws guard prevents it; never weaken it.
