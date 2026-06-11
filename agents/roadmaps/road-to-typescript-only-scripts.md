---
complexity: structural
---

# Roadmap: TypeScript-only scripts — full Python → TypeScript migration

> End state: zero Python in source — every `src/scripts/*.py`, every consumer-shipped template script, the installer, the council CLI, and the pytest suite are replaced by TypeScript with measurably non-degraded quality, and `pyproject.toml` / `.venv` / the `python3` runtime requirement are removed.

## Goal

Replace all ~952 Python source files (~204k LOC: `src/scripts/` 419 files, `tests/` 413 files, `src/agent-src/templates/scripts/` ~100 files) with TypeScript, while every quality gate (linter finding counts, CI green floor, golden behavior, consumer-facing CLI contracts) stays provably at or above today's level.

## Prerequisites

- [ ] Read `CLAUDE.md` / `AGENTS.md` and `docs/architecture.md` (content pipelines A→D).
- [ ] Inventory confirmed (2026-06-11): linters/checks 101 files (~17.4k LOC, incl. `skill_linter.py` 3.7k), condense/sync pipeline 8 files (~3.8k, incl. `sync_yaml_rt.py` comment-preserving YAML), ai_council 55 files (~17k), hooks 16 files (~2.6k), memory/telemetry 13 files, `install.py` 5.1k LOC, `_lib/` 26 files (~6.2k), misc ~191 files (~44.5k incl. `mcp_server.py`, `_cli/cmd_doctor.py`, `chat_history.py`, bench/release tooling), consumer templates ~100 files (work_engine 78 / memory 7 / telemetry 9).
- [ ] Call surface confirmed: 60+ `python3` invocations in `taskfiles/*.yml`, 40+ in `.github/workflows/*.yml`, 3 in `package.json`, 15+ doc references in `src/rules` + `src/skills`, git hooks via `hooks/hooks.json`.
- [ ] Existing TS infra: `src/cli/`, `src/server/`, `src/shared/`, `src/install/`, strict ES2022 tsconfig, vitest, Node >= 20.11, typescript 5.9 + tsx 4.22 devDeps.

## Context

The package is a hybrid Python + TypeScript system; the user wants a single-language TypeScript codebase. Driven by the AI-council convergence of 2026-06-11 (claude-sonnet-4-5 + gpt-4o, design mode, deep): both members converged on (a) migration infrastructure before any porting (dispatch wrapper, parity harness, YAML round-trip spike, drift reconciliation), (b) the installer as consumer trust boundary that must go dual-mode **before** consumer-shipped templates migrate, (c) pytest→vitest 1:1 ports as the behavioral specification plus golden replay as the output-compatibility gate — never "redefine test intent", (d) sequential gated phasing with CI entry/exit gates instead of a parallel-agent control plane, (e) delete each Python original in the same PR as its TS port (rollback = `git revert`, the dispatcher falls back), and (f) an intentional-divergence review process so TS-side bug fixes are documented improvements, not silent parity breaks. Council verdict details are inlined per phase below.

- **Feature:** none (infrastructure migration)
- **Jira:** none

### Execution model (locked)

Sequential gated phasing **across** phases, subagent fan-out **within** a phase. A phase starts only when the previous phase's exit criteria are green on the integration branch. Within a phase, an orchestrator session splits the cluster into dependency-free batches (~5–15 scripts each) and dispatches them to parallel porting subagents; each batch lands as one PR. State tracking is the roadmap checkbox layer + the migration dashboard (Phase 1); rollback is `git revert` of the porting PR — the dispatcher then resolves the restored `.py` again. No separate control plane.

### Branch strategy (user-mandated, locked)

- **Integration branch `python2ts`** is the working trunk of this migration. It is cut from `main` in Phase 1 and lives until the migration is complete.
- **Every migration PR targets `python2ts` — never `main`.** No migration commit, port, infra change, or teardown step goes directly against `main`. CI (migration gates + full pipeline) runs on PRs targeting `python2ts`.
- **`main` stays the consumer-facing trunk** and keeps receiving normal (non-migration) work throughout. A scheduled sync merges `main → python2ts` (see Phase 1) so the migration continuously absorbs mainline changes instead of diverging toward a big-bang conflict.
- **The final `python2ts → main` integration merge is a delivery decision owned by the user** — it is intentionally not a roadmap step (Hard Floor: production-trunk merge, explicit per-turn confirmation).

### Subagent orchestration

- **Orchestrator (one session per phase):** builds the batch manifest (script list, dependency order, fixture set per batch), spawns the porting subagents, collects results, runs the phase exit gate, and updates roadmap checkboxes + dashboard.
- **Porting subagents (parallel, capped ~5–10 concurrent):** each works in an isolated git worktree on a `feat/py2ts-<phase>-<batch>` branch cut from `python2ts`; deliverable per subagent = TS port + 1:1 vitest port + green golden/coverage/error parity + `.py` deletion, as a PR against `python2ts`.
- **Verification subagents:** independent of the porter, a verifier re-runs the parity harness on each batch before the PR is marked ready (porter never green-lights its own parity claim).
- **Merge order:** foundation-first within the phase (libs before dependents); review and merge cadence stay with the user / repo policy — subagents produce ready PRs, they do not merge.
- **Embarrassingly parallel clusters** (Phase 4 linters, Phase 8 misc, test-port work) get the widest fan-out; dependency-ordered clusters (Phase 2 `_lib/`, Phase 9 work_engine core) run narrower, ordered waves.

### Target layout & naming conventions

- TS ports land **beside** their Python originals: `src/scripts/<name>.py` → `src/scripts/<name>.ts` (same basename, same CLI contract). `src/scripts/_lib/*.py` → `src/scripts/_lib/*.ts`. Consumer templates: `src/agent-src/templates/scripts/**.py` → same path `.ts`, shipped compiled (see Phase 9).
- Internal tooling runs via `tsx` (no precompile; acceptable startup for lint/CI tasks). Consumer-shipped scripts and git-hook entry points ship as compiled JS (esbuild single-file bundles where startup cost or dependency isolation matters).
- Python style (`snake_case` CLI flags, exit codes, stdout/stderr split) is part of the contract — TS ports keep flags, exit codes, and output channels identical unless a documented divergence says otherwise.

## Phase 1: Migration infrastructure (blocking — nothing ports before this is green)

Council verdict: this phase is mandatory before any script is ported; the YAML spike and the dispatcher are explicit blockers.

- [x] **Step 1:** Record the architecture decision as an ADR via the `adr-create` skill: execution model (sequential gated phasing + subagent fan-out within phases, no control plane), branch strategy (`python2ts` integration branch, no migration PR against `main`), dispatcher design, parity strategy (vitest-1:1 + golden replay + error parity), same-PR deletion rule, divergence-review process, target layout. Reference this roadmap's council convergence inline (date + members, no session paths).
- [ ] **Step 2:** Set up the integration branch: cut `python2ts` from current `main` and push it; configure branch protection for `python2ts` (required checks = full CI + migration gates; no force-push; PRs only); add a guard check that fails any PR labeled/branch-prefixed `py2ts` whose base is not `python2ts`, so no migration PR can silently target `main`. Document the rule in `docs/contracts/` (branch-protection-policy addendum). <!-- carve-out: new-gate-verification -->
- [x] **Step 3:** Wire the `main → python2ts` sync: a scheduled workflow (and manual task target) that merges `origin/main` into `python2ts`, opens a conflict PR when the merge is not clean, and reports sync lag (commits behind main) into the migration dashboard.
- [x] **Step 4:** Build the dispatch wrapper `src/scripts/run.ts` (compiled entry `dist/scripts-run.js` + thin `./scripts-run` shim): given a script path without extension, prefer `<path>.ts` (via tsx in dev, compiled in CI) and fall back to `<path>.py` via `python3`. Pass through argv, stdin, stdout/stderr, and exit code unchanged. Unit-test the resolution order, passthrough fidelity, and the not-found error.
- [x] **Step 5:** Switch ALL call sites to the dispatcher in one sweep: `taskfiles/*.yml` (60+), `.github/workflows/*.yml` (40+), `package.json` scripts (3), `hooks/hooks.json` dispatch, and the `python3 scripts/…` references in `src/rules/` + `src/skills/` markdown (15+, then re-run `task sync`/condensation so projections regenerate). Verify with a repo-wide grep: no direct `python3 src/scripts/` invocation remains outside the dispatcher and documented carve-outs (pytest itself).
- [x] **Step 6:** Build the parity harness under `src/scripts/parity/` (TS): (a) golden-replay runner — execute Python and TS versions of a script on identical fixtures, capture stdout/stderr/exit code/written files, compare byte-exact with an opt-in JSON/YAML normalization layer; (b) coverage-diff tool — compare `pytest --cov` baseline vs `vitest --coverage` per ported cluster, fail if TS < Python on line or branch coverage; (c) error-parity mode — fixture corpus of failure scenarios (bad input, missing file, invalid flags) comparing error text, output channel, and exit code. Harness itself gets vitest tests.
- [x] **Step 7:** Run the YAML round-trip spike (blocking gate): port a representative slice of `sync_yaml_rt.py` comment-preservation behavior against the `yaml` npm Document API, with fixtures covering inline comments, block comments, blank-line preservation, anchors/aliases, and flow-style collections — compare TS round-trip output byte-exact against ruamel.yaml output. Record the verdict (library OK / alternative needed / documented formatting divergence) in the Phase 1 ADR or a follow-up ADR. <!-- carve-out: new-gate-verification -->
- [x] **Step 8:** Build drift reconciliation: a nightly CI job that, for every open migration PR, diffs the touched `.py` files at the merge-base vs `origin/python2ts` and posts a rebase-required warning on divergence; plus a documented merge rule — migration PRs rebase onto latest `python2ts` before merge, and golden replay always runs against `origin/python2ts`'s Python (which absorbs `main` via the Step 3 sync), never the branch's stale copy.
- [x] **Step 9:** Create the intentional-divergence process: `docs/migration/divergences/` with a template (symptom, root cause, verdict bug-fix-vs-regression, evidence test, approval line) and a CI check that fails when golden parity is red for a script without a matching divergence file. Amend the quality floor wording: quality must not degrade; documented improvements are allowed and explicitly approved.
- [x] **Step 10:** Add phase-gate CI: a `migration-gates` workflow (running on PRs targeting `python2ts`) with one exit-gate job per roadmap phase (all scripts of the phase have a `.ts`, vitest green, coverage-diff green, golden parity green or divergence-documented, `.py` deleted). Later phases' porting PRs fail the gate check until the previous gate is green on `python2ts`. <!-- carve-out: new-gate-verification -->
- [x] **Step 11:** Document the consumer template consumption model: audit `src/scripts/install.py` + `docs/` to pin down whether `dist/agent-src/templates/scripts/` is copied into consumer projects (consumer-owned after copy) or invoked in-place from the package — write the finding into the Phase 1 ADR; Phase 9's mechanics depend on it.
- [x] **Step 12:** Audit and justify the Node floor: confirm which ES2022+ features are load-bearing, decide the supported Node range, enforce it in the installer and CI (matrix on the minimum + current LTS), and document the floor in README/getting-started.
- [x] **Step 13:** Stand up the migration dashboard: a TS script that counts remaining `.py` files per category, ported/total per phase, coverage deltas, open divergences, and `python2ts` sync lag vs `main` — emitted as `agents/evidence/migration-status.md` and refreshed by CI or per-phase.

**Exit criteria:** `python2ts` exists with branch protection + base-guard check; main-sync workflow live; dispatcher live on all call sites with zero behavior change (full existing CI green via dispatcher, on `python2ts`); parity harness self-tests green; YAML spike verdict recorded; drift job live; divergence process + phase gates in CI; consumption model + Node floor documented; ADR merged.
**Rollback:** revert the call-site sweep (dispatcher is additive until Step 5); the `python2ts` branch is additive (deleting it reverts the strategy without touching `main`); each infrastructure piece is independently revertible.

## Phase 2: Shared libraries (`src/scripts/_lib/` — 26 files, ~6.2k LOC)

Everything downstream imports these; they port first.

- [ ] **Step 1:** Port pytest suites for `_lib/` to vitest 1:1 (mechanical translation only: `parametrize` → `test.each`, `monkeypatch` → `vi.mock`, fixtures → `beforeEach`); run them against the Python originals via subprocess where applicable to baseline.
- [ ] **Step 2:** Port `_lib/agent_settings.py` (840 LOC — settings schema, enumerate_modules, YAML I/O) with golden parity on real settings fixtures; reuse/align with any existing settings logic in `src/server`/`src/cli` instead of duplicating.
- [ ] **Step 3:** Port the remaining `_lib/` modules in dependency order (YAML/JSON/schema/caching utils, `agent_src.py`, `value_ladder.py`, `value_report.py`), deleting each `.py` in the same PR after vitest + golden parity are green.
- [ ] **Step 4:** Run the coverage-diff gate for the cluster and update the migration dashboard.

**Exit criteria:** `src/scripts/_lib/` contains zero `.py`; vitest coverage ≥ pytest baseline; all importers (still Python) keep working — full CI green (Python scripts that imported `_lib` keep their own embedded copies until their phase; no cross-language imports).
**Rollback:** revert per-batch PRs; dispatcher restores Python resolution.

> Note: Python scripts in later phases must NOT import half-migrated libs across languages. Where a later-phase Python script imports `_lib`, the Python `_lib` files it needs stay in place until that script's own phase deletes them — the per-file deletion rule applies per importing cluster, tracked by the dashboard.

## Phase 3: Dual-mode installer (consumer trust boundary)

Council verdict: redesign natively in TS (venv logic becomes obsolete), but config generation output stays golden-identical; must land before any consumer-shipped script migrates.

- [ ] **Step 1:** Extract `install.py` behavior into a spec: enumerate generated files/configs, prompts, OS branches, scopes, error paths; capture a golden corpus of installer outputs (config files, directory trees) across representative scenarios using the existing pytest installer/e2e fixtures (`tests/fixtures/installer-e2e/`, ADR-087).
- [ ] **Step 2:** Build the TS installer in `src/install/` (extending the existing TS install code): identical config generation (golden-verified), Node-version check with a clear error, multi-OS paths, and a dual-mode transition layer — detects Python-era artifacts (`.venv`, copied `.py` templates) and handles both worlds during the migration window.
- [ ] **Step 3:** Port the installer test suites (pytest `tests/install/`, `tests/test_install_wizard_wiring.py`, container e2e per ADR-087) to vitest/TS-driven equivalents; keep the Docker e2e gate working against the TS installer. <!-- carve-out: new-gate-verification -->
- [ ] **Step 4:** Flip the consumer entry points (npx flow, `scripts/install.sh`, server/wizard `apply` path in `src/server/routes/wizard.ts`) to the TS installer; `install.py` stays in-tree as documented fallback until Phase 11 removes it.

**Exit criteria:** TS installer produces byte-identical configs on the golden corpus (or documented divergences); container e2e green; wizard + npx flows run the TS installer end-to-end; consumers on either stack can install successfully.
**Rollback:** entry points point back at `install.py` (one-line revert per entry point).

## Phase 4: Linters & CI checks (101 files, ~17.4k LOC)

Largest CI-gate cluster; stateless CLIs — port in batches.

- [ ] **Step 1:** Port the `check_*` family (44 files) in dependency-free batches: vitest 1:1 ports first, then the script, golden parity on the repo itself (the repo is the fixture — finding counts and messages must match), `.py` deleted per batch PR.
- [ ] **Step 2:** Port the `lint_*` family (57 files) the same way, including `lint_roadmap_complexity.py`, `lint_framework_leakage.py`, `lint_media_policy_linkage.py`, and the reference checkers (`check_references.py`, `check_no_roadmap_refs.py`, `check_council_references.py`).
- [ ] **Step 3:** Port `skill_linter.py` (3.7k LOC) as its own batch — it is the single highest-value gate: full vitest port of its pytest suite, golden parity = identical finding sets on the current repo snapshot, plus the error-parity corpus.
- [ ] **Step 4:** Port `check_always_budget.py`, `check_portability.py`, `check_condensation.py`-adjacent validators and `validate_frontmatter.py` with their schemas (`scripts/schemas/`).
- [ ] **Step 5:** Verify the full CI pipeline (`task ci`) runs green end-to-end with zero Python linters left; finding counts on the repo are identical to the pre-phase baseline snapshot (capture the baseline before Step 1).

**Exit criteria:** zero `.py` under the linter/check category; CI finding-count parity vs baseline documented in the dashboard; coverage ≥ baseline.
**Rollback:** per-batch revert.

## Phase 5: Condensation & sync pipeline (8 files, ~3.8k LOC)

Depends on the Phase 1 YAML spike verdict.

- [ ] **Step 1:** Port `sync_yaml_rt.py` (734 LOC) per the spike verdict — byte-exact comment-preserving round-trip or ADR-documented formatting divergence with consumer-impact note.
- [ ] **Step 2:** Port `condense.py` (1.9k LOC) with golden parity over the entire `src/` → `dist/agent-src/` condensation output (the existing condensation hashes are the natural golden corpus — regenerated output must be hash-identical).
- [ ] **Step 3:** Port `sync_gitignore.py`, `update_counts.py`, `sync_agent_settings.py`, `build_discovery_manifest.py` and the remaining sync utilities; update `package.json` build steps to the TS versions.
- [ ] **Step 4:** Run a full `task sync` + `task generate-tools` cycle and verify all generated projections (`dist/agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `dist/router.json`) are byte-identical to the Python pipeline's output (or divergence-documented).

**Exit criteria:** full content pipeline runs Python-free with hash-identical output; CI condensation-hash verification green.
**Rollback:** per-script revert; condensation hashes catch silent drift immediately.

## Phase 6: Hooks (16 files, ~2.6k LOC)

Startup latency matters — hooks run on every tool call / commit.

- [ ] **Step 1:** Port `hooks/dispatch_hook.py` (universal dispatcher) and `hooks.json` wiring to a compiled single-file bundle (esbuild) — measure cold-start vs Python baseline and record it; hooks must never block the agent loop (exit 0 guarantee preserved).
- [ ] **Step 2:** Port the individual hooks (`context_hygiene_hook.py`, `roadmap_progress_hook.py`, `minimal_safe_diff_hook.py`, `hooks_doctor.py`, pre-commit hooks) with their pytest suites → vitest; golden parity on the JSON envelopes they read/write (e.g. `agents/runtime/state/context-hygiene.json`).
- [ ] **Step 3:** Update hook-doc references in rules (`context-hygiene.md` Copilot fallback command, etc.) via source edits + re-condensation; verify `hooks_doctor` (TS) reports a healthy installation.

**Exit criteria:** zero `.py` hooks; hook envelopes byte-compatible; cold-start within agreed budget (documented); global-binary resolution per ADR-020 unchanged.
**Rollback:** `hooks.json` re-points to Python hooks (kept until phase exit).

## Phase 7: Memory & telemetry (dev-side, 13 files, ~3.1k LOC)

- [ ] **Step 1:** Port `memory_lookup.py` (705 LOC — the `retrieve()` API cited by rules), `memory_report.py`, `memory_status.py` with vitest 1:1 + golden parity on real memory fixtures; update the `memory-access` guideline's invocation snippet in source and re-condense.
- [ ] **Step 2:** Port `router_telemetry.py` and the `telemetry:record` / `telemetry:status` CLI surface keeping the recording contract (`contexts/contracts/artifact-engagement-flow.md`) and storage schema byte-compatible.
- [ ] **Step 3:** Port the remaining dev-side memory/telemetry utilities; delete the Python originals per batch.

**Exit criteria:** memory + telemetry CLI contracts unchanged (error parity included); zero `.py` in the cluster.
**Rollback:** per-batch revert.

## Phase 8: Reporting, MCP, doctor & misc tooling (~199 files, ~46k LOC)

The long tail — value/adoption reporting (8 files), `mcp_server.py` (1.4k), `_cli/cmd_doctor.py` (1.6k), `chat_history.py` (1.8k), release/bench utilities.

- [ ] **Step 1:** Port the dashboard/value cluster (`update_roadmap_progress.py`, `adoption_snapshot.py`, `adoption_report.py`, `value_report` consumers) — golden parity on `agents/roadmaps-progress.md` regeneration and the value reports; `./agent-config roadmap:progress` flips to the TS implementation.
- [ ] **Step 2:** Port `mcp_server.py` to TS (align with `internal/glama` packaging; re-run `task mcp:glama-test` so the stored build/CMD paths stay valid — see the 2026-06-04 glama sync-break learning).
- [ ] **Step 3:** Port `_cli/cmd_doctor.py` and `chat_history.py` with their suites.
- [ ] **Step 4:** Triage the remaining misc scripts: port actively-used ones in batches; propose deletion (with evidence of zero call sites) for dead bench/one-shot scripts instead of porting — deletions surfaced explicitly per `non-destructive-by-default` (bulk-deletion commits need the diff surfaced).
- [ ] **Step 5:** Update the migration dashboard; confirm `src/scripts/` is Python-free except `council_cli`/`ai_council` (Phase 10) and `install.py` (Phase 11).

**Exit criteria:** only the council cluster + installer remain as Python; all taskfile targets in this cluster run TS.
**Rollback:** per-batch revert.

## Phase 9: Consumer-shipped templates (work_engine 78 / memory 7 / telemetry 9 / misc ~6 files, ~17.4k LOC)

Highest consumer risk. Requires Phase 3 (dual-mode installer) and the Phase 1 consumption-model verdict.

- [ ] **Step 1:** Build the consumer compatibility corpus first: error-parity fixtures for every consumer-invoked entry point (work_engine dispatcher, directives, memory_lookup template, telemetry recorder, `implement_ticket`, `pr_review_routing`) — CLI args, stdout/stderr shape, exit codes, state-file schemas (`work_engine/state.py` 694 LOC).
- [ ] **Step 2:** Port `work_engine/_lib/` + `state.py` + `dispatcher.py`, then the directive tree (`directives/ui/audit|review|polish.py` et al.) in dependency order, with the pytest `tests/work_engine/` suite (42 files) ported 1:1 to vitest; golden parity on state-machine transcripts.
- [ ] **Step 3:** Port the consumer memory + telemetry template scripts; keep storage schemas identical so existing consumer state files keep working.
- [ ] **Step 4:** Ship compiled: esbuild single-file bundles into `dist/agent-src/templates/scripts/` so consumers need Node only (no tsx, no node_modules resolution inside consumer projects); wire the build into `task sync`/`generate-tools`.
- [ ] **Step 5:** Apply the consumption-model mechanics from the Phase 1 verdict: if templates are copied into consumer projects, the installer detects existing `.py` copies, warns, and migrates (backup + replace or side-by-side per the ADR); if invoked in-place, add backward-compat tests for the npm-package entry paths and document the change in the changelog/migration guide.
- [ ] **Step 6:** Update every rule/skill/guideline that references `python3 scripts/...` template invocations (e.g. `security-sensitive-stop`'s `memory_lookup` snippet, `linked-projects-onboarding-gate`'s detector snippet, `ui-audit-gate`'s dispatcher path) in `src/` and re-condense; the consumer docs (`templates/AGENTS.md`, getting-started) drop the python3 prerequisite.
- [ ] **Step 7:** Run the turnkey consumer smoke (install into a fresh fixture project via the TS installer, execute a work_engine cycle + memory lookup + telemetry record) inside the existing container e2e harness. <!-- carve-out: new-gate-verification -->

**Exit criteria:** consumer fixture project runs the full template surface Python-free; error/CLI contracts parity-proven; docs/rules reference Node invocations only; migration guide for existing consumers written.
**Rollback:** ship the previous Python templates in `dist/` again (regenerate from the last pre-phase tag of `src/agent-src/templates/`); installer dual-mode keeps old consumers working regardless.

## Phase 10: AI council (55 files, ~17k LOC)

Internal but interconnected; ports late so earlier phases can keep using it for design verdicts.

- [ ] **Step 1:** Port `ai_council/` core in dependency order (config 1.4k, clients 1.4k, router 1.1k, prompts, redactor, low-impact intake) with the `tests/ai_council/` suite (27 files) 1:1; golden parity on estimate output, session/response JSON schemas, and the redactor's forbidden-content classes.
- [ ] **Step 2:** Port `council_cli.py` (2.6k LOC) preserving the full subcommand surface (`estimate`, `run`, `debate`, `render`, `replay`, `quota`, `shadow-report`), flags, cost-disclosure output, and quota/cap behavior — error parity included (spend gates must fail identically).
- [ ] **Step 3:** Update the `ai-council` skill, `/council:*` commands, and the memory note that pins the repo-local invocation path; verify a real `estimate` (no spend) and one `--confirm` smoke run against the TS CLI.

**Exit criteria:** council CLI contract identical (a saved responses JSON renders byte-identical); spend/quota gates verified; zero `.py` under `ai_council/`.
**Rollback:** per-batch revert; the Python CLI remains the entry point until Step 2 lands.

## Phase 11: Installer finalization

- [ ] **Step 1:** Remove the Python fallback path from the TS installer; delete `src/scripts/install.py` and its dist copies; entry points (`install.sh`, npx, wizard) reference TS only.
- [ ] **Step 2:** Delete venv management remnants (`.venv` bootstrap, `requirements*`-handling) from installer + taskfiles; the installer's Python-era artifact detection now only warns-and-migrates.
- [ ] **Step 3:** Re-run the container e2e installer matrix (fresh install, upgrade-from-Python-era install) green.

**Exit criteria:** installer codepath 100% TS; upgrade path from a Python-era consumer install verified in e2e.
**Rollback:** restore `install.py` from git history (kept intact until this phase's PRs merge).

## Phase 12: Teardown & final audit

- [ ] **Step 1:** Port or retire the remaining pytest infrastructure: every remaining `tests/**/*.py` either has a vitest equivalent (ported in its cluster's phase) or a documented retirement note; delete the pytest suite, `conftest.py`, `pyproject.toml`, and pytest/xdist from CI workflows. The diff removes >5 files by design — surface the full deletion list for explicit confirmation per `non-destructive-by-default` before the deletion lands.
- [ ] **Step 2:** Remove the dispatcher's Python fallback branch (keep the dispatcher itself — it is now a plain TS runner) or inline it away; sweep taskfiles/workflows/docs for any residual `python3` mention.
- [ ] **Step 3:** Delete `.venv` / `.venv-mcp` bootstrap logic, Python references in `.github/workflows` setup steps, and the Python sections of contributor docs; update `CLAUDE.md`/`AGENTS.md` emergency triage and `docs/architecture.md`.
- [ ] **Step 4:** Final audit: repo-wide `find` proves zero tracked `.py` files outside explicitly documented carve-outs (none expected); migration dashboard reports 100%; archive the dashboard snapshot into `agents/evidence/`.
- [ ] **Step 5:** Close the loop on quality: regenerate the baseline comparison (linter finding counts, CI runtime, coverage) vs the pre-migration snapshot and record the final report (including a CI-runtime before/after) in `agents/evidence/migration-final-report.md`.

**Exit criteria:** zero Python in source and CI; quality report shows finding-count and coverage parity-or-better; docs consistent.
**Rollback:** Step 1's deletion PR is the only hard-to-partially-revert step — it lands last and standalone for clean revertability.

## Acceptance Criteria

- [ ] Zero tracked `.py` files in source (`src/`, `tests/`, `agents/`, `internal/glama`); no `pyproject.toml`, no `.venv*` bootstrap, no `python3` in taskfiles/workflows/package.json/docs.
- [ ] Every ported script met the per-script gate: vitest suite ported 1:1 and green, coverage ≥ Python baseline (line + branch), golden replay green or divergence documented + approved, error parity for consumer-facing scripts, Python original deleted in the same PR.
- [ ] Condensation/projection outputs hash-identical through the TS pipeline (or ADR-documented divergence).
- [ ] Consumer fixture e2e: fresh install + upgrade-from-Python-era + full template-surface smoke green on the supported Node floor.
- [ ] Linter finding counts on the repo identical to the pre-migration baseline (or improvements documented as divergences).
- [ ] All quality gates pass (`task ci` full pipeline, container e2e).

## Notes

- **Divergence ledger:** `docs/migration/divergences/` is the single place where TS-vs-Python behavior differences live; an undocumented difference is a regression by definition.
- **Drift rule:** any `.py` patched on `python2ts` after a port branch was cut (including patches absorbed from `main` via the scheduled sync) → the port PR rebases before merge; golden replay always runs against `python2ts`'s Python.
- **Branch discipline:** every branch in this migration is cut from and PRs back into `python2ts`; `main` is touched only by the scheduled `main → python2ts` sync (read direction) and by the final user-owned integration merge (write direction, outside this roadmap, Hard Floor).
- **Boundaries:** do not refactor business logic while porting (minimal-safe-diff applies per script — port first, improve via documented divergence or follow-up); do not touch generated trees by hand; `src/` stays the single source of truth.
- **Bench corpus** (`internal/bench/` clones with ~2.9k fixture `.py` files) is test fixture data, not source — out of scope for porting; retire or keep as fixtures per Phase 8 triage.
