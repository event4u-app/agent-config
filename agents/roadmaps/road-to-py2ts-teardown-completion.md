---
status: ready
slug: py2ts-teardown-completion
title: "py2ts teardown — completion: purge remaining live-python, retire the shim, merge-ready"
parent_roadmap: py2ts-teardown
---
<!-- check-refs: skip -->

# Road to py2ts Teardown Completion

> Captures everything still open to FINISH the Python→TypeScript teardown on
> `python2ts`. The structural deletions already landed (no `src/**/*.py`, no
> pytest CI, no toolchain, dispatcher pure-`tsx`, `dist/` 0 `.py`; full TS suite
> green python-free via the `python-free-env.ts` shim). What remains is the
> deferred test-layer purge (the shim's scheduled follow-up), the CI/scaffolding
> cleanup it unblocks, and consumer + merge readiness. The
> `python2ts → main` merge (#613) is the user's Hard-Floor decision and stays
> out of scope.
>
> **Progress already on `python2ts` (this branch):** golden-transcript replay
> subsystem fully re-platformed to TS+vitest (29/29, Python deleted); R6/R7
> Phase A stripped obsolete raw live-parity blocks from 170 test files (547 dead
> skipped tests gone, suite still `4801 passed / 0 failed`);
> `generate_pack_manifests._py_safe_dump` converted to a python-free intent suite.

## Current state (evidence)

- `git ls-files '*.py'` → 7 intentional fixtures only (3 `internal/`, 4
  `tests/hooks/fixtures/concern_*.py`); none under `src/`.
- Full `vitest run` → `4801 passed / 2450 skipped / 0 failed` (python shadowed
  by `tests/_lib/python-free-env.ts`).
- ~288 test files still carry a python-gated block the shim force-skips:
  **269 oracle-backed** (`runIf(py3)` blocks routed through the snapshot oracle)
  + **19 raw `main()`-only parity rigs** anchored to the real repo tree.
- Migration-scaffolding workflows still present: `py2ts-base-guard.yml`,
  `py2ts-drift.yml`, `py2ts-main-sync.yml`.

## Phases

### Phase 1 — Purge the remaining live-python test layer

- [ ] **269 oracle-backed `runIf(py3)` files** — per file, decide whether the
  `runIf(py3)` gate is *stale* (the block already reads the frozen oracle
  snapshot → drop the gate so it runs python-free) or *load-bearing* (still does
  a live capture-verify → leave gated). Convert the stale ones to ungated
  oracle-snapshot tests; verify python-shadowed green per file.
- [ ] **19 raw `main()`-only parity rigs** — each is a pure parity rig (its only
  test was the live `python3 <src>.py` vs `tsx` comparison) anchored to the real
  repo tree. Per twin: if covered elsewhere → delete the dead rig; if its
  `main()` is cleanly hermetic (target-path arg) → fresh intent test; otherwise
  parametrize the module's `ROOT` (src change, minimal) to enable a hermetic
  intent test. Do **not** resurrect env-brittle byte-parity snapshots.
- [ ] **`config_packs` / `config_session_profiles` live-parity blocks** —
  resolve the env-brittle (manifest/generated-state-dependent) blocks per the
  parent roadmap's Phase-5 detection gate: make the source read committed state,
  or drop the live-parity block once the logic is covered by unit tests.
- [ ] **Retire `tests/_lib/python-free-env.ts`** — once no test file needs the
  python3-shadow, remove the shim from `vitest.config.ts` `setupFiles` and the
  file itself. Confirm the suite is green python-free *by construction*.

### Phase 2 — CI + scaffolding cleanup (unblocked by Phase 1)

- [ ] Remove the migration-scaffolding workflows once parity is no longer
  tested anywhere: `py2ts-base-guard.yml`, `py2ts-drift.yml`,
  `py2ts-main-sync.yml` (+ any `migration-gates` python-parity step).
- [ ] `grep -rn python3` across tracked code (excluding fixtures + docs prose)
  → zero invocation sites.
- [ ] Confirm remote CI green on `python2ts` after the workflow removals
  (the PR is the authoritative gate).

### Phase 2b — AI-council live-call layer (py2ts gap, discovered 2026-06)

> Surfaced while trying to run the council on this roadmap: every billable
> council client in `src/scripts/ai_council/clients.ts`
> (`AnthropicClient`/`OpenAIClient`/`GeminiClient`/`XAIClient`) is a **throwing
> twin** — the constructor raises `"<sdk> package not installed"` because no
> Node-native SDK was wired; only injected mock clients (tests) work. So the
> council **cannot make any live API call** post-migration (on `python2ts` or
> `main`). The python SDKs (`anthropic`, `openai`) are importable on the host,
> but the TS twins never bridge to them, and `council_cli.py` is deleted.

- [ ] Decide the council's live-call transport: wire Node-native SDKs
  (`@anthropic-ai/sdk`, `openai`, `@google/genai`) into the TS clients, OR a
  `spawnSync`-to-python bridge for the SDK call (the `_runSubprocess` seam
  already exists), OR explicitly accept "council is dev-only via injected
  mocks" and document it. (Decision likely belongs in the council itself once
  the live path exists — chicken-and-egg until then.)
- [ ] Implement the chosen transport for each billable member; add a real
  smoke (one live call, gated, low-token) so the throwing-twin regression
  can't recur silently.

### Phase 3 — Consumer + merge readiness

- [ ] Consumer smoke (baseline A): install into a sandbox consumer and run a
  shipped skill-script (`corpus-grounding/bm25_search`, `design-tokens/tokens`)
  + roadmap-progress via the installed package's `tsx`. Confirm end-to-end.
- [ ] **A-vs-D empirical gate:** if the smoke shows consumers invoke `dist/`
  skill-scripts without reachable `tsx`, switch shipped skill-scripts to
  fallback D (pre-bundled `.js`, node-only) and re-smoke; otherwise stay on A.
- [ ] Decide whether `python2ts` is synced with latest `main` one final time
  before the merge (avoid a late big-bang conflict) — surface the decision.
- [ ] Hand back to the user: `python2ts → main` final merge (#613) is the
  user's Hard-Floor decision (out of scope for the agent).

## Non-goals / out of scope

- The `python2ts → main` merge itself (#613) — user Hard-Floor decision.
- Re-running the structural deletions (src `.py`, pytest CI, toolchain) — done.
- Resurrecting env-brittle byte-parity snapshots — rejected (a snapshot that
  bakes generated/repo state passes locally but is silently wrong).

## Acceptance criteria

- No test file spawns live `python3` (shim removed, suite green by construction).
- `grep -rn python3` over tracked code → 0 invocation sites (fixtures/docs aside).
- Migration-scaffolding workflows removed; remote CI green on `python2ts`.
- Consumer smoke confirms the installed runtime resolves; A-vs-D call recorded.
- Remaining decision surfaced to the user: the `python2ts → main` merge.
