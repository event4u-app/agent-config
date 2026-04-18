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

- [ ] **1.1** Choose the pilot skill. Candidates: `tests-execute`,
      `quality-fix`, `commit`. Pick the one with the narrowest safe surface.
- [ ] **1.2** Define the minimal `Executor` interface: accepts an
      `ExecutionRequest`, dispatches to exactly one `Handler`, returns a
      typed `Result` (exit code, stdout, stderr, duration, artifacts).
- [ ] **1.3** Implement **one** `Handler` that shells out safely — timeout,
      stdout/stderr capture, working directory, env allowlist. Reuse the
      existing `runtime_safety` / `tool-safety` rules; do not reinvent them.
- [ ] **1.4** Wire the pilot skill to the `Executor` via its frontmatter
      `execution:` block. Agents invoking the skill get a real `Result`.
- [ ] **1.5** End-to-end test: invoke the pilot skill through the dispatcher,
      assert the `Result` matches reality (exit code, captured output,
      non-zero duration, correct artifact paths).
- [ ] **1.6** Update `docs/architecture.md` — the Execution Layer section
      drops the *"scaffold"* label for this one path; everything else stays
      marked experimental.

**Acceptance:** `python3 -m scripts.runtime_dispatcher run <pilot-skill>`
(or equivalent) produces a real `Result` and a green CI job that proves it.

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

## Phase 3: Consolidate installer entry points

**Problem:** `install.py`, `install.sh`, `postinstall*`, `bin/install.php` —
four entry points, overlapping behavior, cross-language debugging surface.
Single mental model is missing.

**Scope:** Declare `scripts/install.py` the **primary installer**. Everything
else becomes a thin wrapper that shells into it. Nothing new is added.

- [ ] **3.1** Audit each entry point. For each: what unique logic lives here
      that is not in `install.py`? Record findings.
- [ ] **3.2** Move any unique logic into `install.py` behind explicit flags.
      Keep its public CLI surface stable.
- [ ] **3.3** Trim `install.sh`, Composer `post-install-cmd`, and
      `bin/install.php` to wrappers — each ≤ 30 lines, single `exec`/`shell`
      to `install.py` with forwarded args.
- [ ] **3.4** Document the hierarchy. `README.md` and `docs/installation.md`
      both state: *"Primary installer: `python3 scripts/install.py`. All
      others are compatibility wrappers."*
- [ ] **3.5** Extend `tests/test_install.sh` to cover every wrapper path —
      same expected output, same exit codes.
- [ ] **3.6** Update `CHANGELOG.md` under 1.6.0: note the consolidation and
      that no consumer-visible behavior changed.

**Acceptance:** All four entry points produce identical output on the test
repo. `scripts/install.py --help` is the only installer docs surface anyone
needs to read.

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
