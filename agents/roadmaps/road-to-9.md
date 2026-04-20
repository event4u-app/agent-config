# Roadmap: Road to 9/10 — Proof of Power

> Make **one thing completely real** instead of five things half-built:
> a minimal but genuine runtime, one end-to-end killer flow, a single installer
> entry point, honest experimental layers, and a tighter product positioning.

Source: External strategic review — *"früher: zu viel versprochen / jetzt:
ehrlich, solide, aber noch nicht durchschlagend"*. Current state is a credible
**B+** (Rules / Skills / Commands / Installer are solid). The five items below
are the bridge from B+ to A / 9-of-10.

**Guiding principle:** Depth over breadth. Every item below either ships a real
capability or removes an unfulfilled promise. No new experimental scaffolds.

## Prerequisites

- [ ] Read `docs/architecture.md` (stable layers) and `docs/observability.md`
      (experimental layers) — know exactly which surface is real today.
- [ ] Read `scripts/runtime_dispatcher.py` — confirm its current scaffold status.
- [ ] Read the `jira-ticket` command and map the gaps vs. a full end-to-end flow.
- [ ] Inventory installer entry points: `scripts/install.py`,
      `scripts/install.sh`, any `postinstall*`, `bin/install.php`.
- [ ] Branch off `main` after 1.4.0 is merged — do not stack on the 1.4.0 PR.

## Context

The 1.4.0 release closed the honesty gap (MIT license, `.agent-src/` rename,
installer consolidation started, experimental layers labeled). What remains is
the **capability gap**: the product reads like a system, but the runtime,
feedback, and lifecycle layers are scaffolds with no real consumer. This
roadmap spends two releases (1.5.0 and 1.6.0) turning one vertical slice from
scaffold into product, and cutting everything that cannot be made real in the
same window.

- **Feature:** none (strategic follow-up to the 1.4.0 external review)
- **Jira:** none
- **Target releases:** 1.5.0 (Phases 1–2), 1.6.0 (Phases 3–5)

## Phase 1: Real minimal runtime (P0)

**Problem:** `ExecutionRequest → Executor → Handler → Result` — only the
request class exists. Everything downstream is a stub. The architecture
describes a system that does not yet run.

**Scope:** One vertical slice, not a framework. Pick a **single** skill and
make it execute for real, end-to-end, with a proper result object and
observable side effects. No plugin system, no multi-handler matrix — one
working path.

- [x] **1.1** Pilot skills chosen. Roadmap-listed candidates (`tests-execute`,
      `quality-fix`, `commit`) target Laravel/PHP/Docker consumer projects
      and have no real execution surface inside this Python/Bash repo.
      Re-evaluated and picked two narrow, safe, read-only pilots authored
      for this repo's actual tooling: `lint-skills` (runs
      `scripts/skill_linter.py --all`) and `check-refs` (runs
      `scripts/check_references.py`). Both live in
      `.agent-src.uncompressed/skills/`.
- [x] **1.2** Added `command` to `VALID_EXECUTION_FIELDS` with argv-form
      validation (list of strings, non-empty). Extended `SkillRuntime` with
      a `command` field and an `is_runnable` property. Dispatcher and
      registry now carry the command through the full chain.
- [x] **1.3** `scripts/runtime_handler.py` — `execute_shell()` runs skills
      via `subprocess.run(shell=False)` with `timeout_seconds`, scrubbed env
      (explicit `DEFAULT_ENV_ALLOWLIST`, no secrets forwarded), explicit
      `cwd`, captured stdout/stderr. Returns a typed `ExecutionResult`
      (exit_code, stdout, stderr, duration_ms, status ∈
      success/failure/timeout/error, timed_out, error, artifacts).
- [x] **1.4** Pilot skills wired through frontmatter `execution:` blocks
      (type: assisted, handler: shell, command: argv list). Registry
      discovers them as `is_runnable: True`.
- [x] **1.5** `python3 scripts/runtime_dispatcher.py run --skill <name>`
      dispatches and executes end-to-end. Pytest suite
      `tests/test_runtime_handler.py` (11 tests) covers success / non-zero
      exit / stderr capture / timeout / command-not-found / empty-command
      guard / non-runtime-handler guard / env scrub, plus two E2E tests
      that run both pilots through the dispatcher and assert real
      `ExecutionResult` fields.
- [x] **1.6** `docs/architecture.md` layer 2 updated — the shell-handler path
      is now labeled **real**; `php` / `node` handlers, pipeline, hooks,
      error taxonomy, and tool registry remain labeled **scaffold**.
      Top-of-file diagram reflects the split.

**Acceptance met:**

```bash
python3 scripts/runtime_dispatcher.py run --skill lint-skills
# → status=success, exit_code=0, duration_ms>0, stdout contains
#   "Summary: <n> pass, <n> warn, 0 fail, <n> total"
python3 scripts/runtime_dispatcher.py run --skill check-refs
# → status=success, exit_code=0, duration_ms>0
```

Full CI green (sync, compression, refs, portability, skill-lint,
marketplace, 345 pytests, readme).

## Phase 2: One killer end-to-end use case

**Problem:** The README demos are generic ("refactor this function"). There
is no reproducible "holy shit" flow that a new user can run in five minutes.

**Scope:** Polish **one** existing command — `/jira-ticket` — into a
demo-quality, fully documented vertical. Do not invent new commands.

- [ ] **2.1** Gap-analyze `/jira-ticket` today: which sub-steps are manual,
      which are brittle, which require project-specific setup. Record the
      gaps in this roadmap.
- [ ] **2.2** Close the top three gaps only. Everything else stays noted as
      "works if your project looks like X".
- [ ] **2.3** Record a transcript / asciinema of the full flow on a
      throwaway sample repo: ticket → code change → tests → PR.
- [ ] **2.4** Add a **Killer Flow** section to `README.md` near the top,
      pointing to the transcript and the exact command. One paragraph,
      one command, one link.
- [ ] **2.5** Smoke test: a cold-clone contributor follows the README
      section and reaches a green PR in under 10 minutes. Fix whatever blocks
      that.

**Acceptance:** README shows exactly one end-to-end flow, backed by a
recorded run and a runnable sample, and it reproduces on a clean clone.

## Phase 3: Consolidate installer entry points ✅

**Status:** Done (2026-04-20).

**Original problem:** `install.py`, `install.sh`, `postinstall*`,
`bin/install.php` — four entry points, overlapping behavior, cross-language
debugging surface, no single mental model.

**Original plan:** Declare `scripts/install.py` the **primary installer**;
everything else a thin wrapper that shells into it.

**What actually happened:** The 3.1 audit showed the roadmap premise did
not match the code. `install.sh` (681 LoC) owned the full payload sync
(`.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`,
`GEMINI.md`), while `install.py` (339 LoC) only handled bridge files
(`.agent-settings`, VSCode / Augment / Copilot JSONs). `install.sh`
tail-called `install.py`. `bin/install.php` only called `install.py`,
which meant Composer users never received the payload sync at all — a
latent bug the roadmap's port plan would have masked. Option 3 (a new
bash orchestrator that keeps the two stages independent) was chosen.

- [x] **3.1** Audit each entry point. Findings: `install.sh` =
      payload sync, `install.py` = bridges, `postinstall.sh` = npm hook,
      `bin/install.php` = Composer hook (missing sync stage).
- [x] **3.2** (Revised) Extracted the bridge-installer call out of
      `install.sh` instead of merging stages. Each stage is now
      independently testable and independently invocable.
- [x] **3.3** Introduced `scripts/install` as the primary bash
      orchestrator. `bin/install.php` (56 → 66 LoC) and
      `scripts/postinstall.sh` (59 → 70 LoC) now route through the
      orchestrator. Both stay under 100 LoC and contain no business
      logic beyond forwarding args.
- [x] **3.4** Documented the two-stage pipeline in `README.md`,
      `docs/installation.md`, `docs/troubleshooting.md`,
      `docs/development.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`.
- [x] **3.5** Added `tests/test_install_orchestrator.sh` for the
      orchestrator and the two wrappers (bin/install.php,
      postinstall.sh). `tests/test_install.sh` continues to cover
      payload sync. Both are wired into `task test` and
      `task test-install`.
- [x] **3.6** `CHANGELOG.md` under `[Unreleased]` records the
      orchestrator addition, the `install.sh` refactor, and the
      Composer sync-bug fix.

**Acceptance:** `scripts/install` is the single mental model for
consumers. Direct stage invocation (`install.sh` / `install.py`)
remains available for advanced use and for CI. Composer users now
receive the full payload sync — previously they did not.

## Phase 4: Resolve fake-depth experimental layers

**Problem:** Observability, Feedback, and Lifecycle layers emit artifacts
(`feedback.json`, lifecycle metrics) that nothing consumes. Complexity
without return.

**Scope:** Per layer, make a binary decision — **(A) remove** or **(B) wire
one real consumer**. No layer survives with zero consumers.

- [ ] **4.1** Inventory: for Observability, Feedback, Lifecycle — list every
      emitter, every artifact, every would-be consumer. Record in this file.
- [ ] **4.2** Decide per layer. Default bias: **(A) remove**. Choose **(B)**
      only if a consumer can ship in the same release.
- [ ] **4.3 (A-branch)** For removed layers: delete code, delete docs in
      `docs/observability.md`, delete tests, delete taskfile targets, note
      the removal under 1.6.0 *"Removed"* in `CHANGELOG.md`.
- [ ] **4.4 (B-branch)** For retained layers: ship the minimal consumer
      loop. Candidate: feedback scores nudge `analysis-skill-router` skill
      preference. Gate with a feature flag, keep the writer side unchanged.
- [ ] **4.5** `docs/architecture.md` and `docs/observability.md` reflect the
      final set of experimental layers. No layer is described without a
      named consumer.

**Acceptance:** Every remaining experimental layer has a named consumer that
actually reads its output. Removed layers leave no dead references in docs
or code (`grep` clean).

## Phase 5: Narrow the vision in README and architecture

**Problem:** README and architecture position the package as a broad "Agent
Governance System". Real depth is in Rules / Skills / Commands / Installer.
The framing over-promises.

**Scope:** Tighten the product description to match what actually ships
after Phases 1–4. No product renaming, no logo changes — wording only.

- [ ] **5.1** Rewrite the README headline and subtitle to match the narrowed
      surface (e.g. *"Agent governance and skill system, with optional
      runtime experiments"*). Keep it one sentence.
- [ ] **5.2** Audit every appearance of "runtime", "observability",
      "feedback", "lifecycle" in `README.md`, `docs/architecture.md`,
      `docs/observability.md`. Each must either (a) refer to a shipped
      capability, (b) be labeled experimental with a link, or (c) be removed.
- [ ] **5.3** Refresh the stack-fit table in `README.md` — only claim
      support where CI proves it (the matrix already exists after 1.4.0).
- [ ] **5.4** Update `AGENTS.md` (root, package-own) to reflect the narrowed
      positioning in its one-paragraph summary.
- [ ] **5.5** Final pass: external reviewer-style scan of `README.md` — is
      there any claim a new user cannot verify in 10 minutes? Fix or drop.

**Acceptance:** README and architecture describe only what Phase 1–4
actually delivered. The stack-fit table, experimental labels, and headline
all agree. A fresh reader cannot point to a claim that isn't backed by
shipped code.

## Acceptance Criteria (overall)

- [ ] Phase 1 ships in 1.5.0; Phases 2–5 ship in 1.6.0 at the latest.
- [ ] One skill executes end-to-end via the runtime with real side effects.
- [ ] README has exactly one headline end-to-end flow, reproducible on a
      clean clone in under 10 minutes.
- [ ] `scripts/install.py` is the single documented installer; all other
      entry points are thin wrappers covered by tests.
- [ ] Every experimental layer has a named real consumer or is removed.
- [ ] README, architecture docs, and CHANGELOG are mutually consistent with
      the shipped surface.
- [ ] `task ci` green on the final merge for each release.

## Non-Goals

- No new experimental layers.
- No new skill categories, no new command families.
- No installer format changes (Composer / npm / submodule stay as-is).
- No rename of the package or top-level directories.
- No migration guide for consumers — the installer output directory
  (`.augment/`) and the public CLI surface stay unchanged.

## Notes

- Prefer removing over preserving when a Phase 4 decision is ambiguous. A
  smaller honest system beats a larger partly-honest one.
- If Phase 1 slips, **do not** start Phase 2 against the scaffold — the
  killer flow is only convincing once the runtime is real.
- Keep an eye on the `road-to-10.md` archive: several of its enforcement
  patterns (preservation gates, CI scoring) apply here too.
