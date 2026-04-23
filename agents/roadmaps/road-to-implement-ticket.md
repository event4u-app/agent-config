# Road to Implement-Ticket — from governed agent to delivery engine

> Turn `agent-config` from an excellent governance / skill system into a
> **must-have delivery product** by shipping one opinionated, visible,
> end-to-end killer flow:
>
> **`/implement-ticket`**
>
> A user gives a ticket or problem statement. The agent refines it,
> pulls bounded memory, plans, implements, tests, verifies, and hands
> back a delivery report — or blocks cleanly on ambiguity with a
> numbered question. No auto-commit. No auto-push. No PR creation.
>
> - **Created:** 2026-04-22
> - **Status:** open, not yet scheduled
> - **Relation to other roadmaps:** absorbs Q36 (showcase flow),
>   Q37 (delivery orchestrator), Q39 (narrative framing) from the
>   external-feedback backlog. Q38 (outcome metrics) and Q40
>   (surface-growth guardrails) remain standalone in
>   [`open-questions.md`](open-questions.md).
> - **Master frame:** [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md).

## Guiding principle

**Linear, opinionated, block-on-ambiguity.** One flow, one shape, no
DAG, no workflow-engine meta-layer. Each step is a composition of
existing skills — `/implement-ticket` is glue, not a new kingdom.
Every step can return `success | blocked | partial`. `blocked` is a
first-class outcome, not a failure.

## Architectural constraints (non-negotiable)

1. **No runtime code in `scripts/`.** `scripts/` is package tooling
   (installers, linters, compression, count sync). Orchestrator
   composition lives inside a skill (`.agent-src.uncompressed/skills/
   implement-ticket/`) plus a command. Any extracted helper modules
   go under `.agent-src.uncompressed/templates/scripts/` so consumer
   repos receive them via the installer.
2. **Technology TBD.** Neither Python nor Bash is committed upfront.
   The spike in Phase 0 picks the runtime; the roadmap must not
   hardcode `delivery_orchestrator.py`.
3. **Personas via session-global `/mode`, never CLI flags.**
   `/implement-ticket` reads `roles.active_role` from
   `.agent-settings.yml`. No `--as senior-engineer` flag. This keeps
   the `mode` contract (see `role-contracts`) as the single source.
4. **No auto-git writes.** The orchestrator stops before `git add` /
   `git commit` / `git push`. The delivery report lists the proposed
   commits; the user runs `/commit` / `/create-pr` explicitly.
5. **Multi-repo is out of V1.** Same-repo only. Multi-repo orchestration
   is a separate roadmap when signal demands it.
6. **Memory retrieval is bounded and typed.** Max 12 hits across
   four types: `domain-invariants`, `architecture-decisions`,
   `incident-learnings`, `historical-patterns`. Memory must change at
   least one visible decision in the delivery report or it does not
   appear — memory is a lever, not decoration.
7. **No generic workflow authoring.** Users do not author their own
   orchestrations via YAML/DSL. V1 ships one flow.

## Scope

**In scope (V1)**
- New skill + command `/implement-ticket` that orchestrates existing
  skills (`refine-ticket`, `feature-plan`, `tests-create`,
  `tests-execute`, `quality-fix`, `review-changes`,
  `verify-before-complete`).
- A `DeliveryState` contract (see
  [`implement-ticket-flow`](../contexts/implement-ticket-flow.md))
  so every step reads/writes the same shape.
- Block-on-ambiguity behaviour wired to `ask-when-uncertain` and
  `user-interaction` numbered options.
- Delivery report as the final output (copyable markdown block with
  diffs summary, tests run, memory hits that changed a decision,
  follow-ups, and suggested next commands).
- Persona policies (advisory / executing split per
  `role-contracts`) influencing risk tolerance and question depth.

**Out of scope (V1)**
- Auto commit, push, PR, or merge.
- Multi-repo delivery.
- User-authored custom flows / DSL.
- Parallel step execution (linear only; parallel is a perf tweak
  the orchestrator doesn't need until benchmarks justify it).
- New memory types or retrieval semantics beyond the existing
  contract.

## Prerequisites

- [x] `refine-ticket` v1 shipped.
- [x] `feature-planning` skill + `/feature-plan` command available.
- [x] `review-changes` + `verify-before-complete` skills available.
- [x] `/mode` + `role-contracts` in place.
- [x] Memory retrieval fallback (`memory_lookup.py`) working.
- [x] Phase 0 spike (see below) — picks runtime + prototype.

## Phase 0 — technology spike ✅ shipped (2026-04-23)

Pick the smallest prototype that proves the linear orchestrator
works end-to-end on one real ticket.

- [x] Prototype step-dispatch in **two** candidate runtimes
      (Bash composition vs. Python skill-runner). Measure boot
      time, error-propagation ergonomics, test-writability.
      *(See [`spike/implement-ticket/bash/`](../../spike/implement-ticket/bash/)
      and [`spike/implement-ticket/python/`](../../spike/implement-ticket/python/);
      benchmark evidence in
      [`spike/implement-ticket/bench-results.txt`](../../spike/implement-ticket/bench-results.txt).)*
- [x] Run both against one synthetic ticket fixture.
      *(Fixture landed at
      [`spike/implement-ticket/fixtures/`](../../spike/implement-ticket/fixtures/)
      — deliberately under `spike/` rather than `tests/fixtures/`
      since Phase 0 code is throwaway and must not leak into the
      production test tree.)*
- [x] Emit the five metrics as JSON lines into
      `agents/logs/implement-ticket/` per
      [Q38](open-questions.md#q38) — gitignored directory, opt-in
      commit for team review, no external telemetry.
      *([`agents/logs/implement-ticket/metrics.jsonl`](../logs/implement-ticket/metrics.jsonl)
      — 18 KB of structured run data across both prototypes.)*
- [x] Decide runtime + location of orchestrator code. Record in a
      short ADR under `agents/contexts/` (not a roadmap).
      *(Decision: **Python 3.10+**, orchestrator under
      `.agent-src.uncompressed/templates/scripts/implement_ticket/`
      per architectural constraint #1. See
      [`adr-implement-ticket-runtime.md`](../contexts/adr-implement-ticket-runtime.md).)*
- [x] Throwaway code lives on a spike branch; nothing merged into
      `.agent-src.uncompressed/` from this phase.
      *(Working branch: `feat/improve-agent-setup-10`; spike code
      sits at repo root under `spike/` and does **not** touch
      `.agent-src.uncompressed/`. Will be deleted once the
      production `/implement-ticket` orchestrator lands.)*

## Phase 1 — DeliveryState + linear dispatcher ✅ shipped (2026-04-23)

- [x] Implement `DeliveryState` per
      [`implement-ticket-flow`](../contexts/implement-ticket-flow.md).
      *(Dataclass under
      [`.agent-src.uncompressed/templates/scripts/implement_ticket/delivery_state.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/delivery_state.py)
      — all 10 contract fields, `Outcome` enum, `StepResult`, and the
      `Step` protocol.)*
- [x] Implement step dispatcher with three terminal states
      (`success | blocked | partial`).
      *([`dispatcher.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/dispatcher.py)
      — linear walk over `STEP_ORDER`, rejects missing handlers and
      silent blocked/partial outcomes up front.)*
- [x] Every step reads + writes `DeliveryState`; no hidden state.
      *(Enforced by the `Step = Callable[[DeliveryState], StepResult]`
      protocol — dispatcher passes the live state, handler returns
      only the outcome + surfaced questions.)*
- [x] Fixture-based tests under `tests/implement_ticket/` cover
      each terminal state at least once.
      *(Seven tests in
      [`tests/implement_ticket/test_dispatcher.py`](../../tests/implement_ticket/test_dispatcher.py)
      — success, blocked, partial, plus guardrails for missing
      handlers and silent block/partial outcomes.)*

## Phase 2 — step wiring to existing skills ✅ shipped (2026-04-23)

- [x] Step `refine` → deterministic gate in front of `refine-ticket`.
      *([`steps/refine.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/refine.py)
      — SUCCESS when ticket carries id + non-trivial title + at
      least one concrete AC; BLOCKED otherwise with three numbered
      options that route to `/refine-ticket`, paste-in-chat, or
      abandon. 8 tests cover id/title/AC deficiencies plus the
      success path.)*
- [x] Step `memory` → bounded retrieval, 12 hits across four types.
      *([`steps/memory.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/memory.py)
      — forwards the four allowed types
      (`domain-invariants`, `architecture-decisions`,
      `incident-learnings`, `historical-patterns`) to
      `memory_lookup.retrieve` with a hard cap of 12. Keys derived
      from `files` → title → AC, stop-words dropped, duplicates
      removed. 6 tests with a spy over `retrieve`.)*
- [x] Step `analyze` → deterministic precondition gate.
      *([`steps/analyze.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/analyze.py)
      — SUCCESS when `refine` + `memory` both succeeded and the
      ticket still carries AC; BLOCKED with numbered retry/abort
      options otherwise. Pure gate, no mutation. 7 tests cover
      single failures, combined failures, and the clean path.)*
- [x] Step `plan` → gate + Option-A delegation to `feature-plan`.
      *([`steps/plan.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/plan.py)
      — blocks on missing `analyze` precondition, blocks with
      `@agent-directive: create-plan` when `state.plan` is empty,
      validates shape (string / list of steps / `{steps: [...]}`)
      otherwise. 11 tests cover every gate path + directive
      formatting.)*
- [x] Step `implement` → gate + Option-A delegation.
      *([`steps/implement.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/implement.py)
      — blocks on missing `plan` precondition; blocks with
      `@agent-directive: apply-plan` when `state.changes` empty;
      validates that every change dict carries a non-empty `path`
      (`file` accepted as alias). Agent applies the plan under
      `minimal-safe-diff` + `scope-control` on the rebound. 7 tests.)*
- [x] Step `test` → gate + Option-A delegation to `tests-execute`.
      *([`steps/test.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/test.py)
      — blocks on missing `implement` precondition; blocks with
      `@agent-directive: run-tests scope=targeted` when
      `state.tests` empty; requires `verdict` ∈ {success, failed,
      mixed} and halts on non-success verdicts so a bad test
      result cannot be silently skipped. 8 tests.)*
- [x] Step `verify` → gate + Option-A delegation to `review-changes`.
      *([`steps/verify.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/verify.py)
      — blocks on missing `test` precondition; blocks with
      `@agent-directive: review-changes` when `state.verify`
      empty; requires `verdict` ∈ {success, blocked, partial} and
      halts on non-success verdicts per `verify-before-complete`.
      7 tests.)*
- [x] Step `report` → delivery-report renderer.
      *([`steps/report.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/report.py)
      — pure deterministic Markdown renderer per the 9-section
      report schema in `implement-ticket-flow.md`. Drops the
      "Memory that mattered" section when no hit carries a
      `changed_outcome` marker; suggests `/create-pr` only when
      `verify` succeeded. 10 tests lock the schema + placeholder
      behaviour.)*

## Phase 3 — block-on-ambiguity + persona policies

- [ ] Every step declares the ambiguities it can surface.
- [ ] When triggered, emit numbered options via `user-interaction`
      and stop. No fallback guess.
- [x] Persona policies: `senior-engineer`, `qa`, `advisory` shipped.
      *([`persona_policy.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/persona_policy.py)
      — frozen `PersonaPolicy` dataclass with five flags
      (`allows_implement` / `allows_test` / `allows_verify` /
      `widen_tests` / `suggests_next_commands`). `qa` widens the
      `run-tests` directive to `scope=full`; `advisory` short-
      circuits `implement`/`test`/`verify` to SUCCESS and drops
      the "Suggested next commands" report section because nothing
      was changed. Unknown names fall back to `senior-engineer`.
      10 policy tests + 4 integration tests lock behaviour.)*
- [x] Integration test: end-to-end full-flow suite covering the
      four-rebound happy path, the report renderer contract (both
      with and without influential memory hits), resume-from-mid-
      flow, and the failed-verdict halt at `test`.
      *([`tests/implement_ticket/test_integration_full_flow.py`](../../tests/implement_ticket/test_integration_full_flow.py)
      — 6 tests exercising the real handlers with a scripted fake
      orchestrator that fulfils the `@agent-directive:` contract.)*

## Phase 4 — delivery report + README hero

- [ ] Report schema (see context doc) — diffs summary, tests,
      memory-hits-that-mattered, follow-ups, suggested next
      commands.
- [ ] README 2-minute demo section adds `/implement-ticket` as the
      flagship prompt (coordinates with Q19 hero rework).
- [x] `AGENTS.md` + `copilot-instructions.md` reference
      `/implement-ticket` as the recommended entry flow.
      *(Command shipped at
      [`.agent-src.uncompressed/commands/implement-ticket.md`](../../.agent-src.uncompressed/commands/implement-ticket.md)
      — agent-facing instructions for the Option-A dispatch loop
      over `python3 -m implement_ticket`, with a directive-to-
      skill mapping table (`create-plan` → `/feature-plan`,
      `apply-plan` → minimal-safe-diff edit, `run-tests` →
      `/tests-execute`, `review-changes` → `/review-changes`) and
      a close-prompt offering `/commit` and `/create-pr` after
      delivery. Both templates now point new projects at
      `/implement-ticket` as the first thing to try; consumer
      projects inherit the reference on install.)*

## Acceptance criteria

- [ ] One real ticket, one fresh clone, one run → verified change set
      (tests green, quality-pipeline green) without the user
      touching any command except `/implement-ticket` and
      `/commit` / `/create-pr`.
- [ ] Persona switch (`senior-engineer` vs `qa`) produces
      **visibly different** delivery reports on the same ticket.
- [ ] At least one run where memory retrieval changed a decision
      and the change is cited in the report.
- [ ] At least one run that correctly `blocks` on ambiguity and
      emits a numbered question.
- [ ] `minimal-safe-diff` + `scope-control` hold across all runs —
      no drive-by edits.

## Metrics (Q38 ✅ decided)

Emitted as JSON lines into `agents/logs/implement-ticket/`
(gitignored by default, opt-in commit for team review). See
[Q38](open-questions.md#q38) and
[`implement-ticket-flow`](../contexts/implement-ticket-flow.md#metrics).

Tracked across the first 20 real runs:
- **Time-to-verified-change** (start → report).
- **Block rate** — % of runs that block on ambiguity (target: >0,
  <50%).
- **Memory-decision rate** — % of runs where retrieval changed an
  outcome.
- **Repeat usage** — runs per user per week.
- **Report rejection rate** — user flags a report as wrong / noisy.

A `task metrics:implement-ticket` target renders the last N runs
as a readable table. No external telemetry, no OpenTelemetry, no
aggregation service.

## Surface-growth guardrails (Q40 ✅ decided — all four gates mandatory)

A second delivery flow (`/implement-bug`, `/implement-spike`,
`/ship-hotfix`, …) may only be drafted when ALL of the following
hold — see [Q40](open-questions.md#q40):

1. ≥10 real `/implement-ticket` runs per week across ≥2 users,
   sustained for 4 weeks.
2. Written justification for why the new flow cannot be a persona
   + a branch inside `/implement-ticket`.
3. Named retirement candidate OR explicit statement that the new
   flow is additive, with rationale.
4. Roadmap amendment + `implement-ticket-flow.md` context update
   BEFORE the new flow drafts its first artifact.

Inside this roadmap's own scope:
- No new skill may be drafted **inside** `/implement-ticket`'s
  scope without a retirement candidate named.
- New steps require a roadmap amendment (not a PR rider).

## Risks

- **Scope creep into DAG engine.** Mitigation: linear-only
  constraint in this roadmap, amend only via roadmap edit.
- **Memory retrieval becomes noise.** Mitigation: decision-change
  rule — memory not cited in report means step discards it.
- **Persona policies diverge from `role-contracts`.** Mitigation:
  persona policies live in `role-contracts` guideline; this flow
  only reads them.

## End state

When this roadmap ships, `agent-config` is no longer read primarily
as *"a strong governance / skills package"*. It becomes:

> **a governed delivery copilot that takes a real ticket and carries
> it to a verified implementation outcome, with memory as leverage
> and personas as posture — and blocks cleanly when the ticket is
> not ready.**

That is the threshold at which the package is genuinely hard to
live without.

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
- [`road-to-autonomous-agent.md`](road-to-autonomous-agent.md) — runtime layer Phase 0
- [`../contexts/implement-ticket-flow.md`](../contexts/implement-ticket-flow.md) — technical contracts
- [`../contexts/agent-memory-contract.md`](../contexts/agent-memory-contract.md) — memory shape
