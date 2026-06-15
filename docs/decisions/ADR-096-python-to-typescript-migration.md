---
adr: 096
status: accepted
date: 2026-06-11
decision: python-to-typescript-migration
supersedes: —
superseded_by: —
phase: py2ts · migration-infrastructure
type: structural
---

# ADR-096 — Full Python → TypeScript migration: execution model, branch strategy, dispatcher, parity gates

## Status

**Accepted** · 2026-06-11. Records the locked design of the TypeScript-only
scripts roadmap (Phase 1, Step 1). Driven by the AI-council convergence of
2026-06-11 (claude-sonnet-4-5 + gpt-4o, design mode, deep): both members
converged on migration infrastructure before any porting, the installer as
consumer trust boundary, pytest→vitest 1:1 ports plus golden replay as the
parity contract, sequential gated phasing instead of a parallel-agent control
plane, same-PR deletion of each Python original, and a documented
intentional-divergence process.

## Context

The package is a hybrid Python + TypeScript system. The Python side spans
~952 source `.py` files (~204k LOC): `src/scripts/` 419 files (linters/checks
~17.4k LOC incl. `skill_linter.py` 3.7k, condense/sync pipeline ~3.8k incl.
the comment-preserving `sync_yaml_rt.py`, ai_council ~17k, hooks ~2.6k,
memory/telemetry, `install.py` 5.1k, `_lib/` ~6.2k, misc ~44.5k), `tests/`
413 files (pytest), and `src/agent-src/templates/scripts/` ~100
consumer-shipped files. The call surface is wide: 60+ `python3` invocations in
`taskfiles/*.yml`, 40+ in `.github/workflows/*.yml`, 3 in `package.json`,
15+ doc references in `src/rules` + `src/skills`, and git hooks via
`hooks/hooks.json`.

The target is a single-language TypeScript codebase: zero tracked `.py` in
source, no `pyproject.toml`, no `.venv`, no `python3` runtime requirement —
while every quality gate (linter finding counts, CI green floor, golden
behavior, consumer-facing CLI contracts) stays provably at or above today's
level. TS infrastructure already exists (`src/cli/`, `src/server/`,
`src/shared/`, `src/install/`, strict ES2022 tsconfig, vitest, Node >= 20.11,
typescript 5.9 + tsx 4.22).

The risk profile is asymmetric: internal lint tooling can tolerate iteration,
but the installer, git hooks, and consumer-shipped template scripts are trust
boundaries where a silent behavior change ships to consumers. That asymmetry
drives every decision below.

## Decision

### 1. Scope — full migration

Migrate all ~952 Python source files to TypeScript. The phased inventory and
sequencing live in the TypeScript-only scripts roadmap (prerequisites
section); this ADR locks the architecture, not the schedule. Bench fixture
clones under `internal/bench/` are test data, not source — out of scope.

### 2. Execution model — sequential gated phasing, subagent fan-out within a phase

- **Across phases: sequential and gated.** A phase starts only when the
  previous phase's exit criteria are green on the integration branch. No
  separate control plane — state tracking is the roadmap checkbox layer plus
  the migration dashboard.
- **Within a phase: parallel subagent fan-out.** An orchestrator session
  splits the phase's cluster into dependency-free batches of ~5–15 scripts
  and dispatches them to parallel porting subagents. Each subagent works in
  an isolated git worktree on a `feat/py2ts-<phase>-<batch>` branch; each
  batch lands as one PR.
- **Verification is independent of porting.** A verification subagent re-runs
  the parity harness on each batch before the PR is marked ready — the porter
  never green-lights its own parity claim.
- **Merge order is foundation-first** within a phase (libs before
  dependents). Subagents produce ready PRs; they do not merge.

### 3. Branch strategy — `python2ts` integration branch

- A long-lived integration branch **`python2ts`** is cut from `main` in
  Phase 1 and lives until the migration completes.
- **Every migration PR targets `python2ts`, never `main`.** A guard check
  fails any `py2ts`-prefixed PR whose base is not `python2ts`.
- A **scheduled `main → python2ts` sync** merges mainline changes into the
  integration branch continuously, so the migration absorbs drift instead of
  diverging toward a big-bang conflict. `main` stays the consumer-facing
  trunk and keeps receiving normal work.
- The **final `python2ts → main` merge is a user-owned delivery decision**
  outside the roadmap (Hard Floor: production-trunk merge requires explicit
  per-turn confirmation).

### 4. Dispatcher design — `src/scripts/run.ts`

A dispatch wrapper resolves a script path without extension: prefer
`<path>.ts` (via tsx in dev, compiled in CI) and fall back to `<path>.py`
(via `python3`), passing argv, stdin, stdout/stderr, and the exit code
through unchanged. Consequences:

- **All call sites switch once** (taskfiles, workflows, package.json, hooks,
  doc references) — before any script is ported.
- **Per-script migration = add the `.ts` + delete the `.py` in the same
  PR.** The dispatcher resolves the new `.ts` automatically.
- **Rollback = `git revert` of the porting PR.** The dispatcher then
  resolves the restored `.py` again — no call-site churn in either
  direction.

### 5. Parity strategy — four stacked gates

1. **pytest→vitest 1:1 ports are the behavioral specification.** Mechanical
   translation only (`parametrize` → `test.each`, `monkeypatch` → `vi.mock`,
   fixtures → `beforeEach`) — never "redefine test intent".
2. **Golden replay.** Execute the Python and TS versions on identical
   fixtures; compare stdout/stderr/exit code/written files byte-exact, with
   an opt-in JSON/YAML normalization layer.
3. **Coverage-diff gate.** `vitest --coverage` must be ≥ the `pytest --cov`
   baseline per ported cluster, on both line and branch coverage.
4. **Error parity for consumer-facing scripts.** A fixture corpus of failure
   scenarios (bad input, missing file, invalid flags) comparing error text,
   output channel, and exit code.

Python style (snake_case CLI flags, exit codes, stdout/stderr split) is part
of the contract — TS ports keep them identical unless a documented divergence
says otherwise.

### 6. Intentional-divergence process

Every golden-parity mismatch requires a divergence doc in
`docs/migration/divergences/` (symptom, root cause, bug-fix-vs-regression
verdict, evidence, approval) before the porting PR can pass CI. The quality
floor reads: **quality must not degrade; documented improvements are allowed
and explicitly approved.** An undocumented difference is a regression by
definition. See `docs/migration/divergences/README.md` for the process.

### 7. Runtime model

- **Internal tooling runs via tsx** (no precompile; acceptable startup for
  lint/CI tasks).
- **Consumer-shipped templates and git-hook entry points ship as compiled
  esbuild single-file bundles** — consumers need Node only (no tsx, no
  node_modules resolution inside consumer projects), and hooks keep their
  cold-start budget and exit-0 guarantee.

## Consequences

- Phase 1 (dispatcher, parity harness, YAML round-trip spike, branch +
  sync + drift infrastructure, divergence process, phase-gate CI) is a hard
  blocker — nothing ports before it is green.
- The same-PR deletion rule prevents a drifting dual-source window per
  script; the cost is that each porting PR must clear all four parity gates
  before merge.
- Later-phase Python scripts must not import half-migrated libs across
  languages; Python `_lib` files needed by an unported importer stay in
  place until that importer's own phase deletes them.
- The `python2ts` branch carries the full migration risk away from `main`;
  consumers see no change until the user-owned final merge.
- Business-logic refactors are forbidden while porting (minimal safe diff
  per script): port first, improve via documented divergence or follow-up.

## Alternatives considered

- **Parallel-agent control plane** (a coordinator service tracking migration
  state outside the repo) — rejected: the roadmap checkbox layer plus a
  dashboard script gives the same visibility with zero extra infrastructure,
  and sequential phase gates remove the coordination problem the control
  plane would solve.
- **Migration PRs against `main`** — rejected: every porting PR would put
  consumer-facing trunk at risk and force the full migration gate set onto
  unrelated mainline work; the integration branch isolates both directions.
- **Big-bang cutover** (port everything on a branch, switch call sites at
  the end) — rejected: the dispatcher makes incremental per-script cutover
  free, with `git revert` rollback per script instead of an all-or-nothing
  merge.
- **Keeping Python originals alongside TS ports** ("soak window") — rejected:
  a dual-source window invites silent drift; git history is the soak window,
  and the dispatcher's `.py` fallback makes a revert behave identically.
- **Rewriting tests idiomatically during the port** — rejected: the pytest
  suite is the behavioral spec; redefining intent while porting destroys the
  only oracle the migration has.

## References

- The TypeScript-only scripts roadmap (full phase plan, inventory, exit
  criteria) — referenced by name; roadmaps are a transient layer and are not
  linked from stable artifacts.
- AI-council convergence 2026-06-11 (claude-sonnet-4-5 + gpt-4o, design
  mode, deep) — inline summary above; council artifacts are local-only.
- `docs/migration/divergences/README.md` — divergence process.
- `docs/migration/divergences/_template.md` — divergence doc template.
- [ADR-012](ADR-012-typescript-cli-shell.md) — TypeScript CLI shell (the
  existing TS infrastructure this migration extends).
- [ADR-087](ADR-087-installer-e2e-test-strategy.md) — installer container
  e2e (the golden corpus base for the dual-mode installer phase).
