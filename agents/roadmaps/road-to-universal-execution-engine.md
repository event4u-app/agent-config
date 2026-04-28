# Roadmap: Universal Execution Engine

> Generalize the `implement_ticket` engine into a universal `work_engine` — input-agnostic, intent-aware. **Pure refactor with backward-compat guarantee. Zero new features.** Foundation for prompt-driven execution (Roadmap 2) and the product-UI track (Roadmap 3).

## Prerequisites

- [ ] Read `.agent-src.uncompressed/commands/implement-ticket.md`
- [ ] Read `agents/contexts/implement-ticket-flow.md`
- [ ] Read `agents/contexts/adr-implement-ticket-runtime.md`
- [ ] Inspect `<engine-src>/implement_ticket/` module structure end-to-end (see Paths below)
- [ ] Re-read `.agent-src.uncompressed/templates/roadmaps.md`

## Paths (canonical, used throughout this roadmap)

The engine is a **template script**, not a repo-root script. Consumers reach it via the `./agent-config implement-ticket` CLI dispatcher. Within this maintainer repo:

| Alias | Resolves to | Role |
|---|---|---|
| `<engine-src>` | `.agent-src.uncompressed/templates/scripts/` | Source of truth — edit here |
| `<engine-mirror>` | `.agent-src/templates/scripts/` | Compressed projection — auto-generated, never edited directly |
| `<engine-tests>` | `tests/implement_ticket/` | Existing in-process behavior tests (sys.path-injected via `conftest.py`) |
| `<engine-cli>` | `scripts/agent-config` (root) | Dispatcher that wires `PYTHONPATH` and calls `python3 -m implement_ticket` |

The repo-root `scripts/` directory hosts **maintainer tooling only** (compress, install, lint, dispatcher) — it never contains the engine. Phase 3's "rename" therefore moves `<engine-src>/implement_ticket/` → `<engine-src>/work_engine/` (mirror auto-follows via `task sync`), not anything at repo root.

## Context (current state)

`/implement-ticket` is the package's strongest workflow: an Option-A dispatch loop over the `<engine-src>/implement_ticket/` Python engine, persistent state in `.implement-ticket-state.json`, persona-aware (via `roles.active_role`), directives `create-plan` / `apply-plan` / `run-tests` / `review-changes`, structured delivery report, permission-gated git.

The weakness: **the killer mechanics are bolted to a ticket input.** Prompts, refactor briefs, "improve this screen"-style requests cannot reach the same depth. The engine's value lives in the loop, not in the ticket-shape — and right now they are coupled.

This roadmap **does not change behavior**. It moves the engine to a shape that can take other inputs in later roadmaps, while every existing `/implement-ticket` flow continues to work behaviorally identical.

- **Feature:** none (architectural refactor)
- **Jira:** none
- **Supersedes part of:** `agents/roadmaps/archive/intent-based-orchestration.md` — fully superseded after R1 + R2 + R3 land

## Target architecture

```
scripts/work_engine/                       ← new module name
  __main__.py
  dispatcher.py                            ← directive-set-selection by state.intent
  state.py                                 ← schema with input.kind, intent, directive_set
  directives/
    backend/                               ← current directive set, repackaged
      refine.py                            ← input.kind=ticket → refine-ticket; others NotImplemented
      plan.py
      apply.py
      tests.py
      review.py
    ui/                                    ← stub interfaces only — R3 fills
    mixed/                                 ← stub interfaces only — R3 fills
  migration/
    v0_to_v1.py                            ← .implement-ticket-state.json → .work-state.json

scripts/implement_ticket/                  ← compatibility shim
  __init__.py: re-export work_engine + DeprecationWarning
```

State schema (shape, not exhaustive):

```json
{
  "version": 1,
  "input": {
    "kind": "ticket",
    "data": { "id": "...", "title": "...", "body": "...", "acceptance_criteria": [...] }
  },
  "intent": "backend-coding",
  "directive_set": "backend",
  "persona": "...",
  "outcomes": { "refine": "success", "plan": "pending" },
  "plan": {},
  "changes": [],
  "tests": {},
  "verify": {}
}
```

`input.kind` is open. `ticket` is the only kind wired in this roadmap. `prompt` lands in R2; `diff` / `file` / `existing-screen` are reserved for R3 or later — schema-validated but raise `NotImplementedError` in dispatch.

## Non-goals

- **No** new commands. `/implement-ticket` stays the only entrypoint to the engine after this roadmap.
- **No** new directive verbs. Backend directive set unchanged in semantics.
- **No** UI- or mixed-pathway implementation. Only stub interfaces for R3.
- **No** behavioral change visible to a current `/implement-ticket` user. Same prompts, same options, same delivery report, same close-prompt.
- **No** engine performance work, telemetry, or failure-recovery features.
- **No** version numbers (per `roadmaps.md` rule 13).

## Phase 1: Golden Transcript Capture (baseline lock)

> **Hard prerequisite for every later phase. No file under `<engine-src>/implement_ticket/` may be touched until this phase exits green.** Behavior can only be protected once it is frozen — this phase captures the freeze against the *current* code, before any refactor. **Live runs only. Synthetic / code-read transcripts are explicitly forbidden** — they freeze interpretation, not behavior.

- [x] **Step 1:** Phase 1 work happens on the current feature branch (`feat/intent-based-development-thinking`) — maintainer decision; no parallel engine work justifies the cost of a separate `golden-capture-baseline` branch off `main`. Freeze-guard scope reduces to: from this commit until the Phase 1 acceptance checkboxes are all green, no commit on this branch may modify `<engine-src>/implement_ticket/` or `<engine-mirror>/implement_ticket/`. Enforcement: every Phase 1 commit message carries the `R1-P1` tag; a lightweight `.github/workflows/freeze-guard.yml` check (added in this Phase as part of the lock) fails CI when a non-`R1-P1` commit on this branch touches the engine paths. Phase 2-7 commits start only after Step 7's lock-marker commit.
- [x] **Step 2:** Build the **capture sandbox** at `tests/golden/sandbox/`. Deliberately minimal — just enough that the engine can plan, edit, run tests, fail, recover, persist state. **No real Laravel/Composer**; the sandbox is a Python module + pytest (matches package tooling, zero external runtime). Structure:
  ```
  tests/golden/sandbox/
    repo/                            ← target codebase the engine plans/edits/tests against
      src/                           ← 1–2 modules, intentionally tiny
      tests/                         ← pytest suite
      pytest.ini                     ← deterministic config (no random order, fixed seed)
    tickets/
      gt-1-happy.json
      gt-2-ambiguity.json
      gt-3-test-failure.json
      gt-4-persona-refusal.json
      gt-5-state-resume.json
    recipes/
      gt-3-recovery.md               ← exact failing-test fixture + exact fix-edit
      gt-5-resume.md                 ← exact SIGTERM checkpoint + state-file inspection commands
  ```
  CI bootstraps the sandbox from committed inputs only; no network, no external state. The sandbox is a wegwerf-fixture: it lives in the package, lives forever, never grows beyond what the 5 GTs strictly need.
- [x] **Step 3:** **Live-run** capture for each of the 5 GT scenarios against the unmodified `<engine-src>/implement_ticket/` engine (invoked via `<engine-cli>`, which wires `PYTHONPATH` correctly), using the sandbox from Step 2. Each GT runs end-to-end with a deterministic, reproducible recipe — no improvisation:
  - **GT-1 — happy path:** prepared ticket fixture with complete AC; all tests pre-prepared green; no external deps. Record refine → plan → apply → tests → review → delivery → close-prompt.
  - **GT-2 — ambiguity halt:** prepared ticket fixture with **one deliberately missing AC item**. Record halt at plan step; inject scripted clarification; record resume.
  - **GT-3 — test failure recovery:** prepared fixture with **one deterministically failing assertion** that passes only after a specific known code edit. Record halt → scripted fix → second-run pass. *Never random failure injection.*
  - **GT-4 — persona refusal:** active-role explicitly set to a persona whose contract refuses the requested task type; trigger refusal mid-flow; record structured `role-mode-adherence` halt marker.
  - **GT-5 — state resume:** engine sent `SIGTERM` at a **deterministic checkpoint** (after `apply` writes to state file, before `tests` directive starts). State file persisted; engine re-invoked; resume recorded. *Never "close terminal and hope".*
- [x] **Step 4:** Build a **Capture Pack** per GT under `tests/golden/baseline/GT-{1..5}/` with this exact structure:
  ```
  GT-x/
    transcript.json          ← all stdout/stderr lines, in order, with timestamps
    state-snapshots/         ← state-file snapshot at every halt point, numbered
    delivery-report.md       ← final delivery report verbatim
    halt-markers.json        ← every @agent-directive: marker + numbered-options block
    exit-codes.json          ← exit code for every engine subprocess invocation
    fixture/                 ← input ticket / config / files used as input
    reproduction-notes.md    ← exact commands, env vars, kill points, expected diff
  ```
  Per-GT structure is identical so a later red-golden tells the reader **why** it changed, not only **that** it changed.
- [x] **Step 5:** Capture SHA256 checksums of **every file in every Capture Pack and the sandbox** into `tests/golden/CHECKSUMS.txt`. Any later edit to any baseline or sandbox file must update checksums in the same commit and reference explicit reviewer sign-off in the message. CI verifies the checksum file matches the tree on every PR — defense against silent baseline edits during refactor.
- [x] **Step 6:** Document the capture protocol in `agents/contexts/implement-ticket-flow.md` — exact inputs, exact invocations, exact kill points, exact fix-edits used in GT-3, exact persona setup in GT-4, sandbox bootstrap commands. A future reader must be able to reproduce every capture against pre-refactor `main` byte-for-byte (modulo timestamps).
- [x] **Step 7:** **Lock the baseline.** Land a single Phase-1-lock commit on the current branch (subject prefix `R1-P1-LOCK:`) once the per-step checkboxes above are green. Merge gate (PR template + CI): sandbox present, all 5 Capture Packs present, checksums valid, freeze-guard green for every `R1-P1` commit, capture-protocol doc reviewed. From the lock commit forward, `<engine-src>/implement_ticket/` is frozen — only Phase 6 reads it for verification; all refactor work moves to `<engine-src>/work_engine/`. (Landed as two-commit pair on `feat/intent-based-development-thinking`: `R1-P1` for sandbox+packs+docs, `R1-P1-LOCK` for `CHECKSUMS.txt` + `.github/workflows/freeze-guard.yml`.)

## Phase 2: State schema and migration

- [x] **Step 1:** Define schema v1 in `scripts/work_engine/state.py` — `input.kind`, `input.data`, `intent`, `directive_set`, `version: 1`, plus all current fields under their existing names. (Shipped at `.agent-src.uncompressed/templates/scripts/work_engine/state.py`; field order envelope-first, strict envelope validation, additive on unknown top-level keys.)
- [x] **Step 2:** Write `scripts/work_engine/migration/v0_to_v1.py` — reads any state file without `version`, wraps `ticket` payload into `input.kind="ticket"`, sets `intent="backend-coding"`, sets `directive_set="backend"`, writes `.work-state.json`. Leaves a `.implement-ticket-state.json.bak`. (Shipped; idempotent on v1 input, refuses to overwrite an existing destination, runnable as `python3 -m work_engine.migration.v0_to_v1`.)
- [x] **Step 3:** Schema-validation tests: schema round-trip, migration from 3 representative legacy state files, error on unknown `input.kind`, error on unknown `directive_set`. (`tests/work_engine/test_state_schema.py` + `tests/work_engine/test_v0_to_v1_migration.py`, 36 cases including round-trip across GT-1 cycle 1, GT-3 cycle 4, GT-5 cycle 5.)
- [x] **Step 4:** Update `agents/contexts/implement-ticket-flow.md` — document the new schema; mark old field paths as "preserved via migration". (New "State schema v1" section; legacy slice fields marked preserved-by-name.)

## Phase 3: Engine module rename

- [x] **Step 1:** Move `scripts/implement_ticket/` → `scripts/work_engine/`. Verify `python3 -m work_engine` works.
- [x] **Step 2:** Add `scripts/implement_ticket/__init__.py` re-exporting from `work_engine` with a `DeprecationWarning` on import. Module docstring states the shim is removed in the next-but-one release.
- [x] **Step 3:** Update internal references — `scripts/agent-config`, `.github/workflows/freeze-guard.yml`, `scripts/check_portability.py`. (Other infra surfaces — `Taskfile.yml`, installer, gitignore — already invoke the engine via the public `./agent-config implement-ticket` CLI, so no edits needed there.)
- [x] **Step 4:** Migrate `tests/implement_ticket/` → `tests/work_engine/` (14 files, mechanical import rewrite). Retain `tests/implement_ticket/test_shim.py` (30 contract tests) covering the DeprecationWarning, public-surface re-exports, and `sys.modules` submodule aliases. Live replay against the Golden-Transcript baseline stays byte-equal.

## Phase 4: Dispatcher generalization

- [x] **Step 1:** Rename internal `ticket` references to `input` where they describe the *generic* input. Keep `ticket` only as a typed input-kind. State field `state.input` replaces `state.ticket` (migration handles the transition).
- [x] **Step 2:** Implement directive-set-selection in dispatcher. `select_directive_set(state) -> str` defaults to `"backend"`. The set is loaded from `directives/{set_name}/`.
- [x] **Step 3:** Repackage current directives under `directives/backend/`. Verify all halt-points and exit-codes preserved.
- [x] **Step 4:** Add `directives/ui/__init__.py`, `directives/ui-trivial/__init__.py`, and `directives/mixed/__init__.py` as stubs that raise `NotImplementedError` with a clear "lands in Roadmap 3" message — anyone manually setting `directive_set` to those gets a guided error, not a crash. Schema enum (`directive_set`) accepts `{"backend", "ui", "ui-trivial", "mixed"}`; backend is the only non-stub. R3 V2's `ui-trivial` path is intentionally pre-listed to avoid a forward-incompatible enum at engine release.
- [x] **Step 5:** `refine` directive routes by `input.kind`: `ticket` → existing `refine-ticket` skill invocation; other kinds raise `NotImplementedError`.

## Phase 5: `/implement-ticket` wrapper rewrite

- [x] **Step 1:** Rewrite `.agent-src.uncompressed/commands/implement-ticket.md` — step 2 ("Prepare the state file") wraps the resolved ticket as `input.kind="ticket"`, `input.data={…}`, calls `python3 -m work_engine`. Step 3 (engine call) uses the new module path. Default state filename is now `.work-state.json`; legacy `.implement-ticket-state.json` migrates via the new `./agent-config migrate-state` dispatcher subcommand (PYTHONPATH-wired wrapper around `python3 -m work_engine.migration.v0_to_v1`), keeps `.implement-ticket-state.json.bak` as safety net.
- [x] **Step 2:** Verify the command's user-facing contract is unchanged: same numbered options, same halt formats (`@agent-directive:`, `>`), same close-prompt, same error surfacing. Manual contract review: (a) engine code untouched in P5 (`git log b80a8d0..HEAD -- '…/work_engine/'` is empty); (b) halt format frozen via single-source `AGENT_DIRECTIVE_PREFIX` constant + `agent_directive()` formatter in `delivery_state.py`; (c) all 168 `work_engine` tests green, including halt-format invariance; (d) the only user-visible string change is close-prompt option 4 (`.implement-ticket-state.json` → `.work-state.json (and any .implement-ticket-state.json.bak)`), which is the AC-mandated file rename — numbered structure (1./2./3./4.), `> ` blockquote prefix, and option semantics unchanged. Byte-equal mechanical proof lands in Phase 6 (Golden Replay harness).
- [x] **Step 3:** Update `.agent-src.uncompressed/skills/command-routing/SKILL.md` to mention `work_engine` as the dispatched module. Added a "Commands that dispatch to a Python engine" section flagging `/implement-ticket` as the one command that delegates to a Python module via `./agent-config implement-ticket`, plus the sibling `migrate-state` subcommand. Documents the dispatch model so agents don't paraphrase engine output or bypass the dispatcher.

## Phase 6: Golden Replay and CI gate

> The validation half of Phase 1. Phase 1 froze behavior; this phase proves the refactor preserved it. **Failing golden = refactor regressed behavior — fix the engine, never the baseline.**

- [x] **Step 1:** Build `tests/golden/harness.py` — replays each captured transcript against `scripts/work_engine/`. Asserts:
  - Exit codes match exactly
  - State-file *structure* matches at every halt point (field names, types, ordering — wording in free-text fields may drift, semantic meaning may not)
  - Delivery report sections (headings, presence of fields) match exactly
  - Halt-point markers (`@agent-directive:`, numbered options) match by structure
  - Implementation: library API in `tests/golden/harness.py` (`replay`, `load_baseline`, `compare`, `replay_and_compare`) + four comparators (`compare_exit_codes`, `compare_state_snapshots` with recursive shape walk skipping `questions`/`report`, `compare_halt_markers` with Strict-Verb on `@agent-directive:` line and structural classification of every `questions` entry, `compare_delivery_report` on `^## ` headings). Pytest entry at `tests/golden/test_replay.py` parametrizes over GT-{1..5}; CLI entry via `python3 -m tests.golden.harness [--scenarios GT-N]`.
- [x] **Step 2:** Run the harness against the new engine. **All 5 transcripts MUST pass before any further work.** A failure here is a hard stop — debug and fix the engine, do not edit the baselines. (All 5 GT scenarios pass cleanly against `work_engine` — `pytest tests/golden/test_replay.py` 5/5 in 1.17s; CLI run reports `all 5 scenario(s) match the locked baseline`.)
- [x] **Step 3:** Wire the harness into `task ci` as a required check. Failing golden = failing build. (Implemented as named `task golden-replay` in `Taskfile.yml` — runs `pytest tests/golden/test_replay.py -v` standalone and is invoked from `task ci` before `task test` for failure-first ordering. GitHub Actions: dedicated step `Golden Replay (R1 engine refactor freeze-guard)` in `.github/workflows/tests.yml` before the full pytest sweep, so PR reviewers see drift at a glance instead of scanning 800+ test names. Workflow `paths:` trigger already covers `scripts/**` and `tests/**`, so engine or recipe changes both invalidate the cached check. Replay runs twice per CI lap — once explicit, once via pytest discovery — sub-second cost, named-step visibility is the point.)
- [x] **Step 4:** Verify `tests/golden/CHECKSUMS.txt` from Phase 1 is unchanged in this branch — confirms no silent baseline edits during the refactor. CI runs the same check. (Audit done: `git log` on `tests/golden/CHECKSUMS.txt` shows three touches since `R1-P1-LOCK` (`21a7a96`) — `a5de45d` "scrub pytest duration in capture summaries" and `0265be9` "sandbox-relative ticket paths in transcript cmd". Both are pre-refactor capture-determinism fixes (pytest wallclock, absolute-path leakage) — they re-locked the manifest after removing environment-leak fields, *not* engine drift. The actual refactor (P3 onwards) made zero touches: `git log 0265be9..HEAD -- tests/golden/CHECKSUMS.txt` is empty. Three independent integrity checks pass on HEAD: (1) `sha256sum -c tests/golden/CHECKSUMS.txt --quiet` exit 0 (committed manifest = committed baseline files), (2) live re-capture into staging produces byte-equal manifest after path normalisation (the same check `freeze-guard.yml` runs on every PR), (3) the harness from S1+S2 replays all 5 GTs structurally green against the live engine. Phase 1 lock is intact for the entire refactor window.)
- [x] **Step 5:** Document the contract in `agents/contexts/implement-ticket-flow.md`. (Added "Replay protocol — Strict-Verb comparison (R1 Phase 6)" section: locked vs. drift-tolerated surfaces table, gate locations (`task golden-replay`, `tests.yml` step, `freeze-guard.yml`), refresh procedure for intentional baseline changes, and replay-specific anti-patterns. Status header updated to flag Phase 6; "See also" links the harness and freeze-guard workflow. The Capture protocol (Phase 1) and Replay protocol (Phase 6) now read as a pair: capture produces the artefact, replay enforces the contract.) — what is locked (structure, exit codes, halt-points), what may drift (free-text wording), how to refresh transcripts when an *intentional* change ships (PR-gated, requires explicit reviewer sign-off).

## Phase 7: Verification and docs

- [x] **Step 1:** Run `task sync && task generate-tools && task ci` — must exit 0 end-to-end, golden harness from Phase 6 included. (Executed end-to-end on `feat/intent-based-development-thinking` HEAD: 4:08 wall-clock, exit 0. Pre-flight caught one stale derived file (`.windsurfrules` drifted from sources `f345809` and `255013a`); regenerated and committed as `a5a0bfe`. All 14 CI subtasks green: consistency, counts-check, check-compression, check-refs, check-portability, validate-schema, lint-skills (183 pass / 113 warn / 0 fail / 296 total), lint-marketplace, check-memory, **golden-replay (5/5 GTs structurally green)**, test (847 passed), runtime-e2e, roadmap-progress-check, lint-readme. The Phase 6 harness is now part of the standard `task ci` failure surface.)
- [ ] **Step 2:** Update `README.md` and `AGENTS.md` — replace any `implement_ticket` references with `work_engine` where appropriate; note the shim and its deprecation horizon.
- [ ] **Step 3:** Write ADR `agents/contexts/adr-work-engine-rename.md` — rationale, migration path, compatibility shim, golden-test contract (capture-before-refactor protocol), deprecation timeline.
- [ ] **Step 4:** Draft a `CHANGELOG` entry under "Unreleased" — pure refactor, no user-visible behavior change, shim deprecation notice.

## Acceptance criteria

- [ ] Capture sandbox present under `tests/golden/sandbox/` with `repo/`, `tickets/`, `recipes/` — minimal Python+pytest, deterministic, CI-bootstrappable from committed inputs only
- [ ] All 5 Capture Packs present under `tests/golden/baseline/GT-{1..5}/` with full structure (transcript, state-snapshots, delivery-report, halt-markers, exit-codes, fixture, reproduction-notes)
- [ ] All 5 captures are **live runs** against unmodified `<engine-src>/implement_ticket/` using the sandbox — no synthetic transcripts; reproduction-notes prove byte-for-byte reproducibility (modulo timestamps)
- [ ] `tests/golden/CHECKSUMS.txt` covers every file in every Capture Pack and the sandbox; CI checksum-verification check is green
- [ ] Freeze-guard CI check rejects any non-`R1-P1` commit on this branch that touches `<engine-src>/implement_ticket/`, `<engine-mirror>/implement_ticket/`, `<engine-src>/work_engine/`, or `<engine-mirror>/work_engine/` before the Phase 1 lock commit lands
- [ ] `<engine-src>/work_engine/` is the canonical module; `<engine-src>/implement_ticket/` is a deprecating shim
- [ ] `.implement-ticket-state.json` files auto-migrate to `.work-state.json` on first run, with `.bak` preserved
- [ ] State schema v1 is enforced; unknown `input.kind` or `directive_set` raises a clear error
- [ ] Backend directive set lives under `directives/backend/`; `ui/` and `mixed/` exist as stubs that raise guided `NotImplementedError`
- [ ] `/implement-ticket` wrapper passes ticket through `input.kind="ticket"` envelope; user-facing prompts, options, halts, and delivery report unchanged
- [ ] All 5 golden transcripts replay green against the new engine in CI; replay harness asserts exit codes, state-file structure, delivery-report sections, halt-marker structure
- [ ] `task ci` exits 0 end-to-end; `check_references.py` clean; linter clean
- [ ] ADR + changelog entry in place

## Open decisions

- **Module name** — `work_engine` (default) vs. `engine` vs. `dispatch`. Lean: `work_engine` (descriptive, doesn't collide with stdlib or common package names).
- **State filename** — `.work-state.json` (default) vs. keep `.implement-ticket-state.json` even after rename. Lean: rename, with auto-migration + `.bak`.
- **Shim removal horizon** — next-but-one release (default) vs. permanent. Lean: next-but-one, with `DeprecationWarning` from day one.
- **Golden-test refresh policy** — PR-gated with explicit reviewer sign-off (default) vs. auto-refresh on intentional engine changes. Lean: PR-gated; auto-refresh defeats the purpose.
- **State schema versioning** — `version: 1` integer (default) vs. semver string. Lean: integer; forward-only migrations.

## Risks and mitigations

- **Synthetic baselines freeze interpretation, not behavior** → live-run capture only; freeze-guard CI rejects refactor commits before Phase 1 merge; reproduction-notes per GT enforced
- **Baseline drift during refactor** (someone "just fixes" `<engine-src>/implement_ticket/` mid-roadmap) → freeze-guard CI check (per-commit `R1-P1` tag enforcement); checksum-verification CI; PR template gate
- **GT-3 / GT-5 captured non-deterministically** → fixed failing-test fixture for GT-3 (specific assertion + specific fix-edit); deterministic SIGTERM checkpoint for GT-5 (after `apply` writes state, before `tests` directive); both documented in reproduction-notes
- **Module rename breaks consumers** → compatibility shim with `DeprecationWarning`; `check_references.py` enforced in CI
- **State migration loses data** → `.bak` preserved; migration is idempotent; recovery instructions in ADR
- **Golden tests too brittle (wording drift fails CI)** → assert structure not strings; free-text fields explicitly allow-listed for drift
- **Dispatcher refactor introduces silent semantic regression** → 5 live-captured Capture Packs cover the dominant behavioral paths; per-GT reproduction-notes make red goldens debuggable
- **UI/mixed stubs accidentally execute** → `NotImplementedError` with clear "lands in Roadmap 3" message; schema validation rejects manual escape attempts
- **`refine` routing change leaks** → `refine` is the most-touched directive; isolated test covers `ticket` path before merge

## Future-track recipe (deferred)

The pieces this roadmap *enables* but does not implement — explicitly out of scope, tracked in their own roadmaps:

- `input.kind="prompt"` resolver and the refine-prompt skill — **Roadmap 2** (`road-to-prompt-driven-execution.md`)
- Confidence scoring for prompt-reconstructed AC — **Roadmap 2**
- New entry-point command (working name `/do`, decision deferred to R2) — **Roadmap 2**
- `directives/ui/` implementation, existing-UI-audit pre-step, design-review polish loop — **Roadmap 3** (`road-to-product-ui-track.md`)
- `directives/mixed/` implementation, backend-contract-first sequencing — **Roadmap 3**
- `fe-design` migration, `react-shadcn-ui`, stack-detection — **Roadmap 3**
