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
>   Step wiring (Phase 2) still open. Schema **v1** envelope
>   (`work_engine.state` / `work_engine.migration.v0_to_v1`) shipped
>   2026-04-27 as R1 Phase 2 — see [State schema v1](#state-schema-v1)
>   below.
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

## State schema v1

R1 Phase 2 introduces the **wire-format envelope** that lets the
engine accept inputs other than tickets in later releases without
another schema bump. The envelope wraps the legacy slice without
moving any of its fields:

| Field | Type | Purpose |
|---|---|---|
| `version` | int (`1`) | Integer schema version. Loader rejects any other value. |
| `input.kind` | string | Typed input variant. Only `"ticket"` accepted in R1. |
| `input.data` | object | Payload. Carries the v0 `ticket` dict verbatim. |
| `intent` | string | Coarse intent label. Default `"backend-coding"`. |
| `directive_set` | string | Directive bundle name. One of `backend`, `ui`, `ui-trivial`, `mixed`. Only `backend` is wired in R1. |
| _legacy slice_ | … | `persona`, `memory`, `plan`, `changes`, `tests`, `verify`, `outcomes`, `questions`, `report` keep their v0 names and meaning. |

Canonical filename is `.work-state.json` (was
`.implement-ticket-state.json` in v0). Field order on disk is fixed
— envelope first, legacy slice second — so state-snapshot diffs
across re-runs and across the freeze-guard replay stay readable.

The schema is **strict** on the envelope (unknown `input.kind` or
`directive_set` raise `SchemaError`) and **additive** on top-level
keys (unknown extras are dropped on load, not re-emitted on dump).
A reader that pre-dates a future field cannot crash on it, but
also cannot silently relay it forward without an explicit upgrade.

### Migration v0 → v1

A v0 file (no `version` key, ticket under flat `ticket`) is
upgraded by `work_engine.migration.v0_to_v1`:

```bash
python3 -m work_engine.migration.v0_to_v1 .implement-ticket-state.json
```

The migration:

1. Wraps `state.ticket` into `input = {"kind": "ticket", "data": <ticket>}`.
2. Fills `intent = "backend-coding"` and `directive_set = "backend"`
   (the only working directive bundle in R1).
3. Writes the v1 file as `.work-state.json` next to the source.
4. Renames the v0 file to `.implement-ticket-state.json.bak`
   (override with `--no-backup`).
5. Refuses to overwrite an existing destination — accidental
   double-migration on CI fails loud.

`migrate_payload` is **idempotent** on v1 input and **rejects** any
declared `version` other than `0` (absent) or `1`. The library
contract is covered by `tests/work_engine/test_v0_to_v1_migration.py`,
which exercises three real Phase 1 baseline snapshots (GT-1
cycle 1, GT-3 cycle 4, GT-5 cycle 5) so the migrator is proven
against actual engine output rather than synthetic fixtures.

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

### Declared ambiguity surfaces

Every step declares — in code — the conditions under which it
can return `blocked`. The declarations live as module-level
`AMBIGUITIES` tuples (see
[`steps/__init__.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/__init__.py)
`.all_ambiguities()`). The
[`test_ambiguity_coverage.py`](../../tests/implement_ticket/test_ambiguity_coverage.py)
suite locks the contract: adding a new `blocked` path without
declaring it fails the build.

| Step | Codes | Shape |
|---|---|---|
| `refine` | `missing_id`, `trivial_title`, `missing_or_vague_ac` | deterministic gate |
| `memory` | — | always succeeds (zero hits is valid) |
| `analyze` | `upstream_refine_failed`, `upstream_memory_failed`, `lost_ac` | deterministic gate |
| `plan` | `upstream_analyze_failed`, `empty_plan_delegate`, `malformed_plan` | delegation gate |
| `implement` | `upstream_plan_failed`, `empty_changes_delegate`, `malformed_changes` | delegation gate |
| `test` | `upstream_implement_failed`, `empty_tests_delegate`, `malformed_tests`, `bad_test_verdict` | delegation gate |
| `verify` | `upstream_test_failed`, `empty_verify_delegate`, `malformed_verify`, `bad_verify_verdict` | delegation gate |
| `report` | — | pure renderer, always succeeds |

Delegation-gate `empty_*_delegate` codes emit an `@agent-directive:`
so the orchestrator runs the matching skill (`feature-plan`,
`apply-plan`, `run-tests`, `review-changes`) and resumes. All
other codes halt the flow with numbered options for the user.

## Delivery report schema

A copyable markdown block with fixed sections (any section may be
empty, but all headings are present unless explicitly marked
*droppable*):

1. **Ticket** — one-line restatement.
2. **Persona** — active role + policy summary.
3. **Plan** — ordered steps actually executed.
4. **Changes** — files, line ranges, one-sentence purpose each.
5. **Tests** — what ran, verdicts, durations.
6. **Verify** — review verdict + confidence level.
7. **Memory that mattered** *(droppable)* — only hits that changed
   an outcome. When no hit carries a `changed_outcome` marker the
   entire section (heading included) is omitted so the reader
   doesn't mistake "nothing influential" for "memory is broken".
8. **Follow-ups** — deferred work, with file:line anchors.
9. **Suggested next commands** *(droppable)* — `/commit`,
   `/create-pr`, etc. Never run automatically. Advisory personas
   produce a plan-only report and omit this section entirely
   because nothing was changed.

Implementation: see
[`steps/report.py`](../../.agent-src.uncompressed/templates/scripts/implement_ticket/steps/report.py).
Section renderers are pure and deterministic; consumers can rely
on the heading order and on each section either rendering with
content or being omitted per the rules above.

## Metrics

Emitted as structured JSON to a local log (location chosen in
Phase 0 spike) so the roadmap's metrics anchor (Q38) can be
measured without instrumentation sprawl:

- `time_to_verified_change_ms`
- `block_rate` (per 20-run window)
- `memory_decision_rate`
- `repeat_user_runs_per_week`
- `report_rejections`

## Capture protocol — Golden Transcripts (R1 Phase 1)

The Universal Execution Engine roadmap (`R1`) freezes the engine's
observable behaviour before any refactor. The artefact that holds
that freeze is the **Capture Pack** under
`tests/golden/baseline/GT-{1..5}/`. This section is the operator
manual for producing and re-producing those packs.

### Scenarios

| GT  | Surface locked                          | Cycles |
|-----|------------------------------------------|--------|
| 1   | happy path (plan→apply→tests→review→report) | 5 |
| 2   | refine-step ambiguity halt (vague AC)    | 1      |
| 3   | run-tests failed verdict + recovery      | 6      |
| 4   | advisory persona — plan-only delivery    | 2      |
| 5   | state-resume from disk between cycles    | 5      |

### Inputs

- Toy domain: `tests/golden/sandbox/repo/` — a 4-function
  calculator (`add`, `subtract`, `power`-stub, `divide`) plus a
  pytest config and tests. Deterministic, no I/O.
- Ticket fixtures: `tests/golden/sandbox/tickets/gt-{1..5}-*.json`.
  Schema matches `implement_ticket`'s `ticket_loader`.
- Recipes: `tests/golden/sandbox/recipes/gt{1..5}_*.py`. Each
  exposes `META` (gt_id, ticket fixture, persona, cycle cap) and
  `build_recipe(workspace) -> {directive_verb: callable}`. The
  recipe is the deterministic stand-in for the agent: every halt
  is resolved by hard-coded edits + state-mutations.

### Invocation

Each cycle is a fresh `./agent-config implement-ticket` subprocess
seeded from the persisted state file. The runner
(`tests/golden/sandbox/runner.py`) chains them:

```bash
./agent-config implement-ticket \
    --ticket-file tests/golden/sandbox/tickets/gt-1-happy.json \
    --state-file <workspace>/.agent-state/implement-ticket.json \
    --workspace <workspace> \
    --output-format json
# subsequent cycles drop --ticket-file; the engine loads the
# ticket from the saved state.
```

The runner is invoked via the capture driver:

```bash
python3 -m tests.golden.capture                 # all five GTs
python3 -m tests.golden.capture --scenarios GT-3
```

### Kill points & resume

The runner re-executes the engine on every cycle, so resume from
disk is exercised by **every** GT — not just GT-5. GT-5 simply
records the contract under a different operation (negate vs.
multiply) so byte-equal regression detection covers an additional
state shape. There is no "two-segment" runner mode; the segmentation
is implicit in the per-cycle subprocess fork.

### Capture Pack layout

```
tests/golden/baseline/GT-N/
├── transcript.json       # per-cycle stdout/stderr + exit codes
├── state-snapshots/      # state file after each cycle (cycle-NN.json)
├── halt-markers.json     # extracted directives + numbered questions
├── exit-codes.json       # per-cycle exit codes only
├── delivery-report.md    # final report (or stub if flow halted)
├── reproduction-notes.md # per-GT regenerate command + invariants
└── fixture/              # frozen copy of the input ticket
```

The driver also writes `tests/golden/baseline/summary.json` (one
row per GT: outcome, exit code, cycle count) and
`tests/golden/CHECKSUMS.txt` (sorted SHA256 of every file under
`tests/golden/baseline/` plus the input fixtures).

### Determinism guarantees

- `PYTHONHASHSEED=0`, `PYTHONIOENCODING=utf-8`,
  `LC_ALL=C.UTF-8`, `NO_COLOR=1` injected by the runner.
- Workspace is a fresh `tempfile.TemporaryDirectory` per scenario;
  the toy repo is materialised into it before cycle 1.
- `agents/memory/` lookups resolve relative to the workspace, so
  every run sees zero curated entries — no host-state leakage.
- Recipes never read the clock, the network, or unbound randomness.
- pytest verdict normalisation lives in
  `tests/golden/sandbox/recipes/_helpers.py::run_pytest`
  (exit 0 → success, exit 1/2 → failed, otherwise → mixed).

### Regenerating the baseline

Only when the engine's observable behaviour intentionally changes:

```bash
python3 -m tests.golden.capture
git diff tests/golden/baseline tests/golden/CHECKSUMS.txt
```

Review the diff; it should match the documented behavioural change
in this file's revision history. Then commit. Drive-by changes to
the baseline are blocked by the freeze-guard CI workflow (added in
Phase 1 Step 7).

### Anti-patterns

- Editing a Capture Pack file by hand. The pack is generated; edit
  the engine or the recipe instead.
- Adding a sixth GT without amending the table above and the Phase-6
  replay harness in lock-step.
- Reading from `agents/memory/` in a recipe. Recipes seed state
  directly; memory belongs to the engine under test, not the test.
- Letting the `_helpers.run_pytest` verdict mapping drift from the
  engine's `state.tests.verdict` contract — they are coupled.

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
- [`../roadmaps/road-to-universal-execution-engine.md`](../roadmaps/road-to-universal-execution-engine.md)
- `tests/golden/` — capture sandbox, recipes, and Capture Packs
- [`agent-memory-contract.md`](agent-memory-contract.md)
- [`../../.agent-src.uncompressed/guidelines/agent-infra/role-contracts.md`](../../.agent-src.uncompressed/guidelines/agent-infra/role-contracts.md)
- [`../../.agent-src.uncompressed/rules/user-interaction.md`](../../.agent-src.uncompressed/rules/user-interaction.md)
- [`../../.agent-src.uncompressed/rules/scope-control.md`](../../.agent-src.uncompressed/rules/scope-control.md)
- [`../../.agent-src.uncompressed/rules/minimal-safe-diff.md`](../../.agent-src.uncompressed/rules/minimal-safe-diff.md)
