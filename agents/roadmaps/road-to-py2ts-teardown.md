---
status: draft
slug: py2ts-teardown
title: "Python → TypeScript migration: Phase 12 teardown"
parent_roadmap: null
---

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

- [ ] Surface the deletion diff (586 files) and obtain explicit user confirmation.
- [ ] Delete `src/**/*.py` (keep the 3 residual fixtures).
- [ ] Verify: full parity suite + `npm run typecheck` + dispatcher resolution green; grep `src/` for any remaining non-fixture `.py` → zero.

## Phase 5 — Delete `tests/**/*.py` Python suite (Hard Floor) — NOT a blanket delete

- [x] Coverage-equivalence audit DONE (2026-06-18, 3 parallel agents, 125 modules) → `py2ts-teardown-coverage-audit.md`. Result: **108 COVERED, ~25 GAP, 1 OBSOLETE, fixtures KEEP.** A blanket delete would have silently dropped ~25 modules of coverage — audit vindicated the stop.
- [ ] **Phase 4.5 (NEW precursor) — port the ~25 GAP modules' missing assertions to `.ts`** before any test deletion. Full list in the audit doc. Includes real security asserts (path-traversal, secret-redaction), `hooks_status` (no `.ts` at all), pricing primitives, per-platform install snapshots, 3 work_engine convergence-loop integrations, contract tests.
- [ ] **Council fork — Golden-Transcript replay harness.** `golden/test_replay.py` + `tests/golden/harness.py` + recipes is a Python-only subsystem with no `.ts` port. Port it, or retire it (the per-step golden-parity rigs may already pin equivalent behavior)? Scope decision → AI council.
- [ ] Reconcile the 4 `work_engine/hooks` partial-gap modules (Batch A deep-gap vs Batch B covered) per-module before deleting those.
- [ ] Only after gaps closed: delete the COVERED + OBSOLETE `.py` test modules + `conftest.py` + `pytest.ini` (Hard Floor diff). **KEEP** all fixtures/recipes (`sandbox/`, `fixtures/`, `gt*.py`, `concern_*.py`, `test_calculator.py`).
- [ ] Atomically remove the pytest CI jobs/steps (`tests.yml` python-tests, `python-version-sweep.yml`, `freeze-guard.yml`, `windows-lockfile-export.yml`, `consistency.yml:184`) in the same diff.
- [ ] Verify: full `.ts` test suite green.

## Phase 6 — Remove Python toolchain + dead fast-paths (Hard Floor)

- [ ] Remove `pyproject.toml`, `requirements*.txt`, `python-version-sweep.yml`, the `migration-gates.yml` python-parity-dep step, and the migration scaffolding workflows once parity is no longer being tested.
- [ ] Remove the dispatcher Python fast-path (`scripts-run` lines 15–19) and the `run.ts` `.py` fallback.
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

**Decision required (test-teardown strategy):** convert all rigs to standalone /
keep `.py` as a test-only anchor / hybrid / phased. Routed to AI council; reshapes
the migration endgame, so surfaced to the user.

## Risk register

- **R1 — shipped consumer runtime (highest).** `dist/agent-src/**/*.py` is executed by consumers, not just dev tooling. Deleting src `.py` without resolving dist emission breaks installed consumers. **Resolved (Phase-0 council, 2026-06-18):** TS-only, Python fully removed; runtime = Node-via-`tsx` (baseline A), pre-bundled `.js` fallback (D) only if Phase-1 evidence forces it. Residual exposure = the empirical A-vs-D call; Phase-3 consumer smoke is the verification.
- **R2 — hook handlers point at `.py`.** Deleting before rewiring `hook_manifest.yaml` silently disables hooks. Gated by Phase-2-before-Phase-4 ordering.
- **R3 — coverage loss.** Deleting the Python test suite could drop assertions the `.ts` tests don't replicate. Gated by Phase-5 coverage-gap check.
- **R4 — dispatcher orphan.** A `.py` with no `.ts` twin becomes unresolvable after deletion. Gated by Phase-1 orphan check.
- **R5 — CI scaffolding vs production confusion.** Removing a production workflow thinking it was migration scaffolding. Gated by Phase-2 classification.
