# `/implement-ticket` — Flow Contract

> Technical contracts for the delivery orchestrator shipped under
> [`road-to-implement-ticket.md`](../roadmaps/road-to-implement-ticket.md).
> This document is the stable reference; the roadmap tracks phased
> delivery.
>
> - **Created:** 2026-04-22
> - **Status:** Phase 1 shipped 2026-04-23 — `DeliveryState` +
>   dispatcher live under
>   [`.agent-src.uncompressed/templates/scripts/implement_ticket/`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/).
>   Step wiring (Phase 2) still open.
> - **Runtime:** Python 3.10+ (see
>   [`adr-implement-ticket-runtime.md`](adr-implement-ticket-runtime.md)).
>   This doc stays shape-focused; implementation details belong to
>   the code and the ADR.

## What this doc is

The **shape** of the flow: states, steps, outcomes, report schema,
metrics. The roadmap tracks what ships when. The runtime is chosen
in Phase 0 and recorded in a short ADR once decided.

## What this doc is *not*

- A runtime implementation spec.
- A DSL for user-authored flows (explicitly out of scope).
- A memory retrieval spec — that lives in
  [`agent-memory-contract.md`](agent-memory-contract.md).

## The linear flow

```
refine → memory → analyze → plan → implement → test → verify → report
```

Eight steps, fixed order, no branching. Each step is a thin
composition over existing skills. `/implement-ticket` adds no new
logic — it adds **sequencing + state + block semantics**.

## `DeliveryState` — the only shared object

Every step reads and writes this shape. No hidden state, no side
channels. Fields (runtime may be dataclass, typed dict, JSON
document — the shape is normative, the container is not):

| Field | Purpose |
|---|---|
| `ticket` | ID, title, body, acceptance criteria, source system |
| `persona` | Resolved from `.agent-settings.yml` `roles.active_role` |
| `memory` | Up to 12 hits across four allowed types |
| `plan` | Structured plan from `feature-plan` |
| `changes` | List of proposed / applied edits with file:line refs |
| `tests` | What ran, verdicts, durations |
| `verify` | `review-changes` verdict + `verify-before-complete` gate |
| `outcomes` | Per-step `success | blocked | partial` + message |
| `questions` | Pending numbered questions when blocked |
| `report` | Final delivery report (populated by `report` step) |

No step may invent fields not declared here. Extensions require a
roadmap amendment + this doc updated.

## `Step` contract

Each step is a function over `DeliveryState` that returns one of:

- `success` — populates its slice, continues to the next step.
- `blocked` — populates `questions` with numbered options, stops
  the flow. Orchestrator emits the questions and exits.
- `partial` — populates its slice AND `questions`; user chooses to
  continue or stop. Orchestrator asks explicitly.

Steps **must** declare, in their skill frontmatter, the
ambiguities they surface — so `blocked` never comes as a surprise.

## Agent directives

Some steps cannot run from pure Python — `implement` performs edits,
`test` and `verify` drive long-running subprocesses, `report` only
renders once all prior slices are populated. These steps halt with
`blocked` and carry an **agent directive** as the first entry of
`questions`:

```
questions = [
    "@agent-directive: implement-plan",         # index 0 — agent-facing
    "> Ticket TICKET-42 — 3 files touched, plan in state.plan.",
    "> 1. Continue — changes applied per plan",
    "> 2. Abort — plan is wrong",
]
```

Contract:

- The directive **is always** `questions[0]` when present.
- The prefix `@agent-directive:` is public contract — changing it is
  a breaking change.
- The directive verb (e.g. `implement-plan`, `run-tests`) names the
  skill or command the agent should invoke next.
- Optional `key=value` pairs follow the verb on the same line. Rich
  payloads belong on `DeliveryState`, not in the directive.
- Numbered user options follow the directive and behave exactly per
  the `user-interaction` rule — the user still decides after the
  agent reports back.

Helpers `agent_directive(name, **payload)` and
`is_agent_directive(line)` live alongside `DeliveryState` in the
`implement_ticket` package.

## Resume semantics

The dispatcher is idempotent on already-completed steps. When a
step's name is already marked `success` in `state.outcomes`, the
dispatcher **skips** it and continues. This is how Option-A
delegation works end-to-end:

1. Dispatcher runs until an agent-directive step halts with
   `blocked`.
2. Orchestrator reads the directive, invokes the matching skill,
   captures the result onto the matching `DeliveryState` slice
   (`state.changes`, `state.tests`, etc.).
3. Orchestrator sets `state.outcomes[step] = "success"` and
   re-invokes `dispatch(state, steps)`.
4. Dispatcher skips completed steps and resumes at the first one
   still pending.

Only the exact string `"success"` triggers the skip. A `"blocked"`
or `"partial"` marker from a prior run **reruns** the step so the
current state is re-evaluated rather than trusting stale evidence.

## Memory retrieval contract

Bounded per the top-level roadmap rule:

- **Max 12 hits total.**
- **Four allowed types:** `domain-invariants`,
  `architecture-decisions`, `incident-learnings`,
  `historical-patterns`. All four exist in the
  [templates directory](../../.agent-src.uncompressed/templates/agents/memory/).
- **Keys:** files touched by the plan, symbols referenced by the
  ticket.
- **Decision-change rule:** a memory hit that did not change an
  outcome is dropped from the report. If none changed an outcome,
  the `memory` section of the report is omitted — not padded.
- Follows the retrieval shape in
  [`agent-memory-contract.md`](agent-memory-contract.md).

## Persona policies

Read from `.agent-settings.yml` `roles.active_role` and resolved
via `resolve_policy()` in
[`persona_policy.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/persona_policy.py).
Policies live alongside the dispatcher so the flow can consume
them directly; the shared
[`role-contracts`](../../.agent-src.uncompressed/guidelines/agent-infra/role-contracts.md)
guideline remains the source of truth for persona behaviour in the
wider agent surface.

Three personas ship today:

| Persona | `allows_implement` | `allows_test` | `allows_verify` | `widen_tests` | `suggests_next_commands` |
|---|:-:|:-:|:-:|:-:|:-:|
| `senior-engineer` (default) | ✅ | ✅ | ✅ | ❌ | ✅ |
| `qa` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `advisory` | ❌ | ❌ | ❌ | ❌ | ❌ |

Behaviour:

- `senior-engineer` — runs every step, targeted tests, full
  delivery report with `/commit` + `/create-pr` suggestions when
  verify succeeds.
- `qa` — identical to `senior-engineer` except the `run-tests`
  directive carries `scope=full` so regressions outside the
  changed paths are caught.
- `advisory` — plan-only mode. `implement`, `test`, and `verify`
  short-circuit to SUCCESS without work; the delivery report
  renders without a "Suggested next commands" section because
  nothing was changed.

Unknown persona names fall back to `senior-engineer`. The policy
is frozen and cached per name — step handlers can call
`resolve_policy(state.persona)` as often as they need.

**No CLI flag overrides `/mode`.** That is the whole point of the
session-global persona contract — one source, readable by any
skill.

## Block-on-ambiguity semantics

When a step returns `blocked`, the orchestrator:

1. Emits the numbered questions per
   [`user-interaction`](../../.agent-src.uncompressed/rules/user-interaction.md).
2. Writes a partial report up to the last successful step.
3. Exits with a `blocked` status — no guess, no fallback.

Resuming is not automatic. The user answers and re-invokes
`/implement-ticket` (or a follow-up command) with the answer in
the context. V1 explicitly does **not** attempt resumable sessions.

## Delivery report schema

A copyable markdown block with fixed sections (any section may be
empty, but all headings are present):

1. **Ticket** — one-line restatement.
2. **Persona** — active role + policy summary.
3. **Plan** — ordered steps actually executed.
4. **Changes** — files, line ranges, one-sentence purpose each.
5. **Tests** — what ran, verdicts, durations.
6. **Verify** — review verdict + confidence level.
7. **Memory that mattered** — only hits that changed an outcome.
8. **Follow-ups** — deferred work, with file:line anchors.
9. **Suggested next commands** — `/commit`, `/create-pr`, etc.
   Never run automatically.

## Metrics

Emitted as structured JSON to a local log (location chosen in
Phase 0 spike) so the roadmap's metrics anchor (Q38) can be
measured without instrumentation sprawl:

- `time_to_verified_change_ms`
- `block_rate` (per 20-run window)
- `memory_decision_rate`
- `repeat_user_runs_per_week`
- `report_rejections`

## Non-goals

- Auto-commit / auto-push / auto-PR (belongs to `/commit`,
  `/create-pr`).
- Multi-repo orchestration.
- User-authored custom flows.
- Parallel step execution.
- New memory types or retrieval shapes.

## Revisit triggers

- First 10 real runs show `block_rate < 10%` → loosen
  block-on-ambiguity (too timid).
- First 10 real runs show `block_rate > 60%` → tighten step
  declarations (ambiguity noise).
- A second flow (`/implement-bug`) is proposed → amend this doc to
  hoist shared contracts BEFORE drafting the second flow.

## See also

- [`../roadmaps/road-to-implement-ticket.md`](../roadmaps/road-to-implement-ticket.md)
- [`agent-memory-contract.md`](agent-memory-contract.md)
- [`../../.agent-src.uncompressed/guidelines/agent-infra/role-contracts.md`](../../.agent-src.uncompressed/guidelines/agent-infra/role-contracts.md)
- [`../../.agent-src.uncompressed/rules/user-interaction.md`](../../.agent-src.uncompressed/rules/user-interaction.md)
- [`../../.agent-src.uncompressed/rules/scope-control.md`](../../.agent-src.uncompressed/rules/scope-control.md)
- [`../../.agent-src.uncompressed/rules/minimal-safe-diff.md`](../../.agent-src.uncompressed/rules/minimal-safe-diff.md)
