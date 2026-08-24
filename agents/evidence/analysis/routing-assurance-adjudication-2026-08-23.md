# Routing-assurance adjudication — doctrine, schemas, and revision log

> **This is an evidence artefact, not estate.** It records design doctrine and
> two schema proposals from a research synthesis dated 2026-08-23, adjudicated
> and landed by the `/analyze:inbox` run of 2026-08-24. It is not a roadmap, it
> registers no work, and it appears on no dashboard.
>
> **Source:** agents/tmp.old/test-concept/agent-config-routing-assurance-roadmaps-2026-08-23.md
>
> **Its three nested roadmaps (A, B, C) were NOT landed**, for two reasons
> established against the tree at landing:
>
> 1. **They largely re-propose archived, completed work.** Roadmap A's Phase 0
>    was an ownership map for the deterministic routing layer. That is already
>    owned and delivered by
>    `agents/roadmaps/archive/road-to-tested-routing.md`, archived at
>    `status: ready` with **38 of 38** boxes done.
> 2. **Their coordination premise was false.** The document repeatedly treats
>    `road-to-agentic-engineering-assurance` as *active* work to coordinate
>    with. It is not: it sits at
>    `agents/roadmaps/archive/road-to-agentic-engineering-assurance.md` with
>    `status: done`, closed 2026-08-23 by an architectural-owner disposition
>    (AI council, 2 of 2 convergent). A plan sequenced against an active
>    roadmap that had already closed cannot be executed as written.
>
> The work that **did** survive adjudication landed separately as
> `agents/roadmaps/road-to-routing-assurance.md` (`status: ready`), which cites
> the archived owners rather than duplicating them. What is kept here is the
> doctrine and the schemas that roadmap consumes.

## Executive finding

The deterministic routing substrate is strong: trigger matching, rule matrices,
hook dispatch, settings resolution, subagent tier resolution, command routing
and several protocol contracts are all directly testable, and all are tested.

That is necessary and not sufficient. The remaining correctness question is
vertical:

```text
user intent
  -> host sees the right capabilities
  -> correct rule / skill becomes reachable
  -> correct tool is selected
  -> arguments are valid and semantically right
  -> correct subagent / model tier is selected
  -> tool result is actually used
  -> failures take the right fallback
  -> forbidden tools/actions are not used
  -> final repository/world state satisfies the goal
  -> evidence says what really happened
```

Each arrow can break while every arrow before it holds. A lower-layer matcher
can be perfect while the host ignores the skill. A tool can be selected
correctly with wrong arguments. A call can return the correct value and the
model can ignore it. A retry can loop forever. A trajectory can look plausible
while the requested state was never achieved. A final answer can look correct
while a forbidden side effect occurred.

The missing product is therefore not another router. It is assurance over what
the real host actually invokes and achieves.

## Baseline to consume rather than duplicate

- deterministic rule-routing matrices;
- the routing doctor and live-install diagnostics;
- composed hook-chain tests;
- command-routing linting;
- pure subagent and model-tier routing functions;
- orchestration-routing decision matrices;
- MCP tool registry, tool declarations and permission validation;
- MCP catalog, manifests and tool probes;
- golden outcomes;
- the archived engineering-assurance roadmap's frozen-corpus, false-verified and
  cost/latency principles;
- the archived MCP-delivery roadmap's ranking and tiering falsifier;
- the parked cross-model roadmap's requirement to measure **real in-host
  invocation**, never this package's own prediction.

## Design doctrine — D1 to D7

### D1 — Test the layer that makes the claim

If the claim is "the matcher would route X", a deterministic matcher test is
correct. If the claim is "the host invokes X", only an in-host trace can
establish it. If the claim is "the task succeeded", inspect the resulting state,
not only the tool-call trace.

### D2 — Deterministic first, stochastic second

Pull requests are gated by deterministic, local, reproducible checks. Real-model
and real-host tests run as canaries, nightly, or release evidence — unless a
stable host fixture makes a particular case deterministic.

### D3 — Outcome and trajectory are different dimensions

A correct outcome with a forbidden tool call is a failure. A perfect reference
trajectory with the wrong final state is a failure. Both must be scored, and
they are independent verdict dimensions.

### D4 — Multiple routes can be valid

Do not overfit every scenario to one golden sequence. Scenario contracts support:

- `strict` — exact sequence matters;
- `unordered` — same required calls, order irrelevant;
- `must_include` — required minimum calls;
- `allowed_subset` — the agent may choose among approved alternatives;
- `must_not_include` — forbidden calls and actions;
- state and outcome assertions — the route is flexible as long as the
  postcondition is met.

### D5 — "No tool" is a first-class expected decision

The corpus must contain tasks where the correct action is **not** to call a
tool, not to spawn an agent, or not to retrieve a skill. Otherwise precision
numbers are artificially easy to improve.

### D6 — Recovery is routing

Unavailable auth, 404, 409, 429, timeout, malformed result, stale schema,
permission denial, context-budget truncation and quota exhaustion are not only
error handling. They are routing decisions about retry, fallback, substitute,
escalation or stop.

### D7 — Every blocking policy needs a falsifier

A new routing or tool mechanism may become default only when a frozen corpus
shows incremental signal over the previous path, or it enforces a hard safety
property.

## Layered architecture (reference model)

**Layer 0 — structural integrity.** Fast static tests, no model, no network:
schemas parse; referenced rule/skill/tool exists; tool action exists;
permissions coherent; MCP manifests and projections synchronized; host
capability declarations valid; roadmap-owned routing contracts have registered
scenario IDs.

**Layer 1 — pure decision tests.** Property and table tests for deterministic
code: trigger matcher, task classification, skill/rule ranker, subagent routing,
tier inference, budget/quota routing, tool adapter selection, fallback
resolution. Plus boundary and selected mutation testing, to prove the tests
would fail if a route were inverted.

**Layer 2 — routing corpus.** One versioned scenario corpus per routed
capability, covering: obvious positive; paraphrased positive; German and English
where user-facing; lexical near miss; semantically similar wrong capability;
`NO_TOOL` / `NO_SKILL` where appropriate; unavailable-capability variant;
context- or budget-constrained variant where relevant.

**Layer 3 — protocol and tool contract.** Exercise MCP and local tool
boundaries: initialize, tools/list, tools/call, argument schema, result
envelope, error envelope, permissions, read-only/write boundary,
traversal/input attacks, unavailable-auth branch, timeout and cancel behaviour.
Call the built artifact where practical, not only imported functions.

**Layer 4 — deterministic trajectory replay.** Normalize host and agent traces
into one envelope, then replay recorded traces deterministically in PRs.

**Layer 5 — sandboxed end-to-end agent tasks.** Real agent against disposable
fixtures: filesystem sandbox, disposable Git repo, local mock HTTP services with
**real protocol behaviour**, local MCP servers, optionally a containerized DB or
browser fixture. The verifier checks final state independently of the model.
Example shapes: "find the broken test and fix only the affected package"; "read
a PR and summarize its changed public API, do not modify it"; "create a
migration plan, do not execute migrations"; "use browser evidence for this
visual bug, do not call the browser for a pure utility".

**Layer 6 — real in-host invocation canary.** The missing prerequisite of the
parked cross-model roadmap. Install exactly as a consumer would; start the host
with a known fixture and prompt; capture observable skill, tool and subagent
invocation events; normalize; verify routing and final state; compare against a
host-native baseline.

**Layer 7 — cross-model / cross-host falsification.** For the same frozen cases
compare host-native baseline, current behaviour, a candidate routing change,
model families and tiers, and supported hosts. Report honest nulls; no
"better" claim without comparative evidence. **Owned by the parked cross-model
roadmap, not by this document.**

**Layer 8 — fault injection and adversarial routing.** Inject: tool absent;
auth missing; permission downgrade; network timeout; 429; stale tool schema;
malformed tool result; empty result; duplicated or similarly-named tools;
misleading tool description; prompt injection inside tool output; exhausted
quota; unavailable cheaper model; truncated skill descriptions; stale projection
or manifest. Assert the expected retry, fallback or escalation, and a hard
maximum loop and call budget.

**Layer 9 — outcome assurance.** Independent state assertions per end-to-end
case: changed files, Git state, created and deleted objects, DB state, browser
state, emitted evidence, and the **absence** of forbidden side effects. This is
the final authority for task success.

## Schema 1 — normalized agent trace

```json
{
  "schema": "ac-agent-trace/v1",
  "scenario_id": "tool.github.read-pr",
  "host": "claude-code",
  "model": "…",
  "steps": [
    {
      "kind": "skill|rule|tool|subagent|model|result|fallback",
      "name": "…",
      "args": {},
      "outcome": "ok|error|denied|timeout"
    }
  ],
  "final": {
    "status": "success|failure|degraded",
    "state_refs": []
  }
}
```

## Schema 2 — canonical scenario contract

Suggested shape under `tests/eval/scenarios/`:

```yaml
schema: ac-routing-scenario/v1
id: github.pr-read-only.001

intent:
  prompt: "Review PR 123 and summarize the API changes. Do not modify it."
  language: en

fixture:
  workspace: fixtures/github-readonly
  capabilities:
    github: available

expect:
  skills:
    must_include: [code-review]
  tools:
    must_include: [github.read_pr]
    must_not_include:
      - github.add_comment
      - github.merge_pull_request
  args:
    github.read_pr:
      pr_number: 123
  trajectory:
    mode: must_include
    max_tool_calls: 4
  final_state:
    repository_mutations: 0

faults: []
tags: [tool-selection, read-only, github]
```

The schema must permit more than one valid tool or skill where alternatives are
equivalent — D4.

## Metrics

Never collapse the source of truth into one vanity score.

**Routing quality:** rule/skill recall; rule/skill false-fire rate; tool
selection precision, recall and F1; correct `NO_TOOL` rate; top-1 and top-k
ranker success; cross-host routing divergence.

**Call correctness:** argument schema-valid rate; required-argument accuracy;
semantic-constraint accuracy; forbidden-action rate; duplicate or redundant call
rate.

**Trajectory quality:** required-step satisfaction; forbidden-step violations;
order violations where order is contractual; max-loop violations; recovery
success; fallback correctness; tool-call efficiency.

**Outcome quality:** task success; state-verifier pass; forbidden side-effect
rate; **false-verified rate** — the harness says verified although a seeded
fault survived.

**Reliability:** pass@1; pass^k / all-k success for stability-sensitive cases;
variance across repeated host and model runs; flaky scenario rate.

**Economics:** model calls; tool calls; prompt and output tokens; wall clock;
incremental cost versus host-native baseline; cost per successful verified task.

## Execution cadence

**Pull request gate** — deterministic and local: Layer 0; Layer 1; changed
Layer-2 scenarios; Layer 3; trace replay; schema and coverage ratchets. No live
paid model is required to merge ordinary code.

**Nightly canary** — small and high-signal: real in-host scenarios; high-risk
routing cases; MCP protocol tasks; a fault-injection sample; key cases repeated
2 to 3 times for drift and stability evidence. A nightly probabilistic failure
produces evidence and an alert; it does not pretend to be a deterministic
unit-test failure.

**Weekly / scheduled benchmark** — wider real-host corpus; cross-model where
credentials exist; adversarial confusers; context pressure and compaction; the
fault matrix; cost and latency; baseline comparison.

**Release evidence** — frozen deterministic corpus; the full supported-host
canary set available to the release environment; regression delta from the
previous release; an honest list of unavailable host and model arms; the
false-verified and forbidden-side-effect report.

## Three-pass revision log

### Pass 1 — broad test pyramid

Initial design: static tests, routing matrices, protocol tests, simulated
agents, real hosts, cross-model, chaos, outcome verification.

**Finding.** This duplicated substantial completed work and risked creating a
second assurance framework beside the engineering-assurance roadmap.

**Change.** Narrowed to a missing-layer architecture: reuse all existing
deterministic routing owners; add a shared scenario and trace contract plus true
host and outcome verification.

### Pass 2 — trajectory-first design

The second design over-emphasized golden trajectories.

**Finding.** Agents often have more than one valid route. Exact sequence
matching would make the benchmark brittle, punish harmless alternatives, and
encourage optimizing for the test rather than the outcome. It also underweighted
the case where the right tool is called but the result is ignored.

**Change.** The scenario language now separates MUST / MAY / MUST NOT; strict
versus unordered versus minimum or allowed route; argument semantics; result
utilization; final state; `NO_TOOL`; and forbidden side effects. Outcome and
trajectory became independent verdict dimensions.

### Pass 3 — real-host-first challenge

The third pass challenged making real-host and real-model end-to-end the primary
CI gate.

**Finding.** That would be expensive, credential-sensitive,
host-version-sensitive and stochastic. It could make the test suite less
trustworthy while still missing deterministic protocol defects. Conversely, pure
deterministic simulation cannot prove the host actually routes as expected.

**Final change.** A deliberate split:

```text
PR:       deterministic ownership + scenarios + protocol + replay
Nightly:  small real-host black-box canaries
Weekly:   wider host/model + fault + context-pressure experiments
Release:  frozen corpus + deltas + false-verified + forbidden-side-effect evidence
```

That yields both deterministic engineering confidence for every commit, and
empirical falsifiability of real-world agent-routing claims.

## Definition of done (the claim shape this doctrine licenses)

> For scenario X, version Y on host H:
> - the intended capability was available,
> - the real host selected the allowed route,
> - required tools were called with valid arguments,
> - forbidden tools and actions were absent,
> - injected failures took the specified fallback,
> - the independent state verifier confirmed the requested outcome,
> - the evidence identifies host, model, version and cost,
> - and the same claim has a deterministic regression representation.

That is substantially stronger than "the prompt looked right", "the matcher
would select it", or "the model said it succeeded".

## Adjudication record (2026-08-24)

| What | Disposition | Why |
|---|---|---|
| Doctrine D1-D7 | **Kept** | Independently defensible and consumed by the landed roadmap. |
| Layer 0-9 reference model | **Kept** as a reference model, with Layer 7 marked as owned by the parked cross-model roadmap | The layering is useful; the ownership note prevents it being read as a claim on another roadmap's scope. |
| `ac-agent-trace/v1` and `ac-routing-scenario/v1` schemas | **Kept** | Concrete, reusable, and not duplicated anywhere in the tree. |
| Metrics and cadence | **Kept** | Same reason. |
| Three-pass revision log | **Kept** | The reasoning that produced the design, including two self-corrections, is the part most likely to be needed again. |
| **Roadmaps A, B and C** | **NOT landed** | Roadmap A Phase 0 (ownership map) is already delivered by `archive/road-to-tested-routing.md` at 38/38; and the coordination section's premise that `road-to-agentic-engineering-assurance` is active is false — it is archived at `status: done`, closed 2026-08-23 by an architectural-owner disposition. |
| Recommended execution order | **NOT carried** | It sequences Roadmaps A, B and C, which were not landed. |
| `status: draft` frontmatter and the `research_pin` block | **Removed** | This file is evidence, not a roadmap: frontmatter would register it with the roadmap linters and put it on the dashboard. The pin is recorded in the source pointer instead. |
| Named external references | **None were present** | The source cited only this repository's own artefacts, so no anonymisation was required — unlike three of the other four documents in the same inbox batch. |

**Verified at landing:** the archived state, `status` and 38/38 box count of
`road-to-tested-routing.md`; the archived state, `status: done` and closure
disposition of `road-to-agentic-engineering-assurance.md` (not present at the
active top level); and the parked `status: later` state of
`later/road-to-cross-model-routing-eval.md` together with its three stated
gates, of which gate (b) — a missing in-host end-to-end harness — is the one
Layer 6 above addresses.
