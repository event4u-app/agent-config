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
- [ ] Phase 0 spike (see below) — picks runtime + prototype.

## Phase 0 — technology spike (1 PR, throwaway allowed)

Pick the smallest prototype that proves the linear orchestrator
works end-to-end on one real ticket.

- [ ] Prototype step-dispatch in **two** candidate runtimes
      (Bash composition vs. Python skill-runner). Measure boot
      time, error-propagation ergonomics, test-writability.
- [ ] Run both against one synthetic ticket fixture
      (`tests/fixtures/implement-ticket/`).
- [ ] Emit the five metrics as JSON lines into
      `agents/logs/implement-ticket/` per
      [Q38](open-questions.md#q38) — gitignored directory, opt-in
      commit for team review, no external telemetry.
- [ ] Decide runtime + location of orchestrator code. Record in a
      short ADR under `agents/contexts/` (not a roadmap).
- [ ] Throwaway code lives on a spike branch; nothing merged into
      `.agent-src.uncompressed/` from this phase.

## Phase 1 — DeliveryState + linear dispatcher

- [ ] Implement `DeliveryState` per
      [`implement-ticket-flow`](../contexts/implement-ticket-flow.md).
- [ ] Implement step dispatcher with three terminal states
      (`success | blocked | partial`).
- [ ] Every step reads + writes `DeliveryState`; no hidden state.
- [ ] Fixture-based tests under `tests/implement_ticket/` cover
      each terminal state at least once.

## Phase 2 — step wiring to existing skills

- [ ] Step `refine` → delegates to `refine-ticket`.
- [ ] Step `memory` → bounded retrieval, 12 hits across four types.
- [ ] Step `analyze` → delegates to analysis router.
- [ ] Step `plan` → delegates to `feature-plan`.
- [ ] Step `implement` → actual edits (guarded by `minimal-safe-diff`).
- [ ] Step `test` → `tests-execute` + `quality-fix` (targeted first).
- [ ] Step `verify` → `review-changes` + `verify-before-complete`.
- [ ] Step `report` → delivery-report renderer.

## Phase 3 — block-on-ambiguity + persona policies

- [ ] Every step declares the ambiguities it can surface.
- [ ] When triggered, emit numbered options via `user-interaction`
      and stop. No fallback guess.
- [ ] Persona policies: `senior-engineer` asks fewer, higher-signal
      questions; `qa` widens the test matrix; `advisory` modes
      never enter `implement`.
- [ ] Integration test: one ticket with deliberately ambiguous
      acceptance criteria must `block` at `refine`, not proceed.

## Phase 4 — delivery report + README hero

- [ ] Report schema (see context doc) — diffs summary, tests,
      memory-hits-that-mattered, follow-ups, suggested next
      commands.
- [ ] README 2-minute demo section adds `/implement-ticket` as the
      flagship prompt (coordinates with Q19 hero rework).
- [ ] `AGENTS.md` + `copilot-instructions.md` reference
      `/implement-ticket` as the recommended entry flow.

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
