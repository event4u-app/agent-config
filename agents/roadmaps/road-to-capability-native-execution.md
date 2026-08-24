---
complexity: structural
status: draft
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived only status: draft roadmaps, which were never counted by collect() and so cannot serve as offsets. The addition is sanctioned on its own terms: a tree-wide grep over agents/roadmaps/*.md and agents/roadmaps/later/*.md for `adapter manifest` and `dispatchab` returns zero files, so no active or parked roadmap owns the subject."
execution:
  mode: phase-checkpoints
research_date: 2026-08-23
ac_pin: d7072e910d0478814358cca576eef585c3a04bfc
---

# Road to capability-native execution — a browser resolver that earns its generality

> **Source:** agents/tmp.old/nxt-lvl-frontend/road-to-capability-native-execution-v2.md

## Goal

A domain skill states the semantic capability, evidence and policy constraints
it needs. It does not name a browser backend. The suite selects a
**dispatchable** implementation for the current task, host and policy, records
which one it chose and why, and can fall back without silently widening trust,
cost, autonomy or evidence scope.

Scope is one vertical: `browser.*`. Nothing here graduates to a general
execution primitive until Phase 9's gate fires.

## Context — what already ships, and what is actually missing

The draft this file lands from proposed four new mechanisms. Three of them
already exist in the tree under different names, and re-anchoring onto them is
the difference between an extension and a fourth parallel router.

**The declarative surface ships.** `src/scripts/schemas/skill.schema.json:45-89`
defines a top-level `runtime_requires` object with `bins`, `env`, `primary_env`
and `network`, described in the schema itself as being "in the form
`doctor`/`preflight` can actually probe", and mandatory for an external
`execution.handler`. Its `$comment` records that zero skills use it today. So
the projection-compatible place for a skill to declare what it needs is present
and unused; what is missing is the **semantic layer above named binaries** — the
abstraction `model_tier` already proves for models, applied to capabilities.

**`requires` as a key name is reserved, and the draft collides with it.** The
same schema states it plainly: `requires` is taken by ADR-015 pack-dependency
edges (a list of pack ids, validated in `build_discovery_manifest.ts`), and
reusing it "makes every skill carrying one unassignable in the discovery
manifest". The draft's proposed `execution.requires:` block is therefore a
naming collision — the second one it carries, alongside a generated root
`CAPABILITIES.yaml`. Both are merge-blocking and are gated in Phase 0.

**The probe taxonomy ships, and it is already seven states.**
`src/scripts/_lib/tool_probe.ts:59` defines
`ToolProbeStatus = 'ok' | 'missing' | 'broken' | 'timeout' | 'error'`, with
every spawn hardened, retry only on timeout, and no throw path.
`src/scripts/reach_doctor.ts:104-110` extends it in both directions:
`ChannelStatus = ToolProbeStatus | 'removed' | 'not-ready'`, so an operator can
tell `missing` (nothing to run) from `not-ready` (installed, answering its probe,
still unable to retrieve). The draft's seven-field `dispatchable` object is a
re-derivation of that seven-state enum with the states flattened into booleans.
This roadmap extends the enum; it does not invent a parallel one. The draft
cites neither file.

**A fixed-priority resolver is precedented.** `src/scripts/_lib/judgment_ladder.ts`
resolves a task to one of five dispatch rungs in a **fixed priority order**, and
its own header states that the order *is* the contract — "two signals matching
the same text must resolve deterministically, never on evaluation-order
accident". That is the shape Phase 4 copies: an ordered filter, not a weighted
score.

**The pilot runs before the selector, and this is measured rather than argued.**
`docs/contracts/budget-routing.md` was **RETIRED 2026-08-16** by a converged
2-of-2 AI council. Its own opening states why: AC1–AC5 "were pre-registered
against a mechanism with no production caller and no possible measurement basis,
so they could never fire — and an acceptance criterion that cannot fire reads as
coverage that does not exist". `session_tier` was non-null in **0 of 327**
orchestration records, and `src/scripts/_lib/tier_budget_routing.ts` still sits
in the tree with its routing machinery removed. Building a selector before its
caller exists is exactly that failure, so the frontend pilot is Phase 3 and the
selector is Phase 4. The pilot exercises each dispatchable adapter explicitly;
that is what produces both the caller and the data the selector needs.

**Ownership.** This roadmap owns the capability request shape, the adapter
manifest and probe, dispatchability, selection, transport/runtime separation, the
normalized outcome envelope, failure and fallback semantics, the tool-instruction
loading boundary, and the expansion gate. It owns no frontend fidelity
semantics, no detector rules, no visual quality judgment, no default flips, no
model routing, no merge authority, no install permission, and no cost or privacy
policy.

## Phase 0 — Governance, collisions and a frozen corpus

Merge-blocking. Nothing in Phases 1-9 is authored before this phase closes.

- [ ] **0.1 Resolve the two naming collisions.** `execution.requires:` and a
      generated root `CAPABILITIES.yaml`. Either extend `runtime_requires` with
      a capability member, or name a third key deliberately with the reason
      recorded.
      `verify:` `grep -n '"requires"' src/scripts/schemas/skill.schema.json`
      shows the ADR-015 reservation intact, and no new top-level key named
      `requires` exists in the schema; the chosen name appears in exactly one
      schema and is validated by `validate_frontmatter`.

- [ ] **0.2 Classify the roadmap against ADR-042, ADR-212 and ADR-088.** Each
      of the three blockers below is answered with a written disposition, not an
      assumption of non-overlap.
      `verify:` each of the three blockers reads `Status: resolved` with a dated
      disposition naming the ADR and the reason this work is or is not inside
      its scope.

- [ ] **0.3 State why the browser vertical is not the reach-channels result
      again.** Blocker `b-reach-channels-precedent`, answered before any adapter
      manifest is authored.
      `verify:` the blocker reads `Status: resolved`, and its disposition names
      at least one property of the browser vertical that the reach benchmark's
      `band: stop` outcome does not transfer to.

- [ ] **0.4 Map existing runtime-routing primitives and forbid a second
      router.** Read `tool_probe.ts`, `reach_doctor.ts`, `judgment_ladder.ts`,
      `tier_budget_routing.ts`, missing-tool handling and missing-skill
      recovery. Every proposed code path either extends one of them or states
      why it cannot.
      `verify:` a table in the roadmap names each primitive, the file, and
      extend-or-not with a reason; no new module duplicates
      `ToolProbeStatus`/`ChannelStatus` or re-implements a priority-ordered
      resolver.

- [ ] **0.5 Freeze the browser benchmark fixtures.** Minimum set: project
      Playwright available; playwright-cli only; MCP only; CLI + MCP; backend
      unavailable; unhealthy backend; capability advertised but not
      dispatchable; evidence-degraded fallback.
      `verify:` the fixture digest is committed in a commit that **precedes**
      the first commit touching any resolver or adapter code.

- [ ] **0.6 Pre-register the outcome bars and their falsifiers.** Dispatch
      success, evidence completeness, token/context cost, wall-clock, setup
      friction, deterministic replay, degraded-run honesty.
      `verify:` every bar has a numeric threshold and a named falsifier, and the
      prereg commit precedes any default-preference change; a bar with no
      falsifier fails the shape check rather than passing.

## Phase 1 — The browser capability request contract

- [ ] **1.1 Define only the capabilities the frontend pilot consumes.**
      `browser.navigate`, `browser.snapshot`, `browser.find`,
      `browser.interact`, `browser.viewport`, `browser.screenshot`,
      `browser.evaluate`, `browser.console.read`, `browser.network.read`,
      `browser.trace`, `browser.session`. No Git/DB/HTTP namespace.
      `verify:` every declared capability has at least one real consumer call
      site and at least one adapter that implements it; a capability with
      neither fails the check.

- [ ] **1.2 Land the declaration on `runtime_requires`, per 0.1's outcome.**
      Required/optional capability semantics, so an absent optional capability
      degrades evidence without failing an unrelated required one.
      `verify:` a fixture declaring `browser.console.read` optional and
      `browser.screenshot` required produces `degraded`, not `failed`, when only
      console evidence is missing.

- [ ] **1.3 Add the evidence and constraint fields.**
      `verify:` a task can express "screenshot required, console preferred,
      personal-profile reuse forbidden, paid remote forbidden" and each of the
      four is machine-readable.

- [ ] **1.4 Add the vendor-coupling lint for domain workflows.** Exempt
      tool-specific skills, migration docs, and examples explicitly marked
      implementation-specific.
      `verify:` the lint is green on the tree as it stands, and a seeded
      violation (a domain skill naming a browser backend in a required position)
      exits non-zero.

## Phase 2 — Adapter manifest and the dispatchability probe

Proving adapters, four: existing project Playwright, playwright-cli, Playwright
MCP, and agent-browser (experimental). Stagehand and Browser Use are
deliberately excluded — both are semantic/agentic backends and fall under the
parked autonomy classes in Phase 6.

- [ ] **2.1 Define the adapter manifest.** Capabilities, transport
      (`library | cli | mcp | host-native | connector`), runtime modes
      (`project | local | container | remote | managed`), version constraints,
      evidence support, lifecycle behaviour.
      `verify:` all four proving adapters validate against one schema, and the
      schema rejects a manifest missing transport or runtime.

- [ ] **2.2 Cheap static availability probe.** PATH, dependency and
      MCP-registration checks only.
      `verify:` the probe launches no browser — a fixture run records zero
      browser processes spawned and completes inside the static-probe budget.

- [ ] **2.3 Compatibility and health probe, extending `ChannelStatus`.**
      `verify:` the wrong-version and broken-runtime fixtures resolve to
      distinguishable states, and every state emitted is a member of the
      extended enum rather than a new boolean.

- [ ] **2.4 Dispatchability proof.** A minimal safe no-op or seed action
      through the actual invocation lane, returning the normalized result.
      `verify:` the advertised-but-undispatchable fixture is rejected **before**
      selection, and the rejection names which condition failed.

- [ ] **2.5 Cache probe results with an explicit basis and freshness.**
      `static | live | cached`.
      `verify:` a stale cached `healthy` cannot authorize a high-impact
      operation — the fixture forces a live re-probe and the test fails if it
      does not.

## Phase 3 — The frontend proving vertical (moved ahead of the selector)

This phase runs **before** Phase 4 deliberately. See § Context: a selector with
no caller is the retired budget-routing shape. Here each dispatchable adapter is
invoked explicitly by the pilot, which is what produces both the caller and the
measurements Phase 4 consumes.

- [ ] **3.1 Convert the frontend review and evidence call site to
      capabilities.**
      `verify:` the call site contains no required backend name; a grep for
      Playwright, playwright-cli, MCP or agent-browser in the caller's required
      path returns zero hits.

- [ ] **3.2 Run the frozen 0.5 fixtures through every dispatchable proving
      adapter, named explicitly.**
      `verify:` each adapter produces the same required evidence contract on the
      same fixture, published with the fixture digest from 0.5.

- [ ] **3.3 Measure context/token and wall-clock differences, suite-owned.**
      External marketing numbers are not evidence.
      `verify:` the bench log records both arms with the fixture digest, and
      every figure is reproducible from a command in the log.

- [ ] **3.4 Record honest nulls.** If an adapter is not cheaper or not more
      reliable, publish that rather than defend it.
      `verify:` the published set covers every bar named in 0.6, with none
      missing and none present that 0.6 does not name.

- [ ] **3.5 Dispatchability negative control in the pilot.**
      `verify:` on the advertised-but-undispatchable fixture the pilot refuses
      before execution and an equivalent adapter completes the same contract.

## Phase 4 — The deterministic selector v0

Modelled on `judgment_ladder.ts`: a fixed priority order where the order is the
contract. No weighted score, at any phase.

- [ ] **4.1 Filter hard constraints first** — capability coverage, policy,
      trust, cost, privacy, compatibility, dispatchability.
      `verify:` an ineligible backend never reaches tie-breaking; a fixture
      asserts the ineligible candidate is absent from the tie-break input set,
      not merely ranked last.

- [ ] **4.2 Add the two task profiles** — deterministic verification,
      interactive inspection.
      `verify:` profile rules are explicit, versioned, and the version appears
      in the emitted reason codes.

- [ ] **4.3 Add dominance rules.** A dominates B when A satisfies the same
      required capabilities, provides at least the same evidence, uses no higher
      autonomy class, crosses no wider trust or cost boundary, and is
      equal-or-better on measured reliability and cost.
      `verify:` an equivalent-but-strictly-weaker candidate is eliminated with
      no numeric weight anywhere in the decision path.

- [ ] **4.4 Empirical tie-break from Phase 3 data only.**
      `verify:` the no-data path is deterministic and stable across two runs;
      the tie-break refuses to fire below the 0.6 sample threshold.

- [ ] **4.5 Emit decision reason codes.**
      `verify:` every selection is explainable from its reason codes alone,
      without the user being shown implementation detail by default.

## Phase 5 — The normalized execution and evidence envelope

- [ ] **5.1 Define the adapter-neutral result envelope.** Capability, adapter,
      version, transport, runtime, autonomy class, resolution source, attempts,
      fallback chain, artifact paths, verification state, degradation reason.
      `verify:` all four proving adapters emit one shape, validated against one
      schema.

- [ ] **5.2 Preserve tool-native artifacts by reference.** Large snapshots and
      traces stay on disk unless a consumer asks for them.
      `verify:` an envelope for a trace-producing run carries a path and not the
      trace body, and the context cost of reading the envelope is bounded.

- [ ] **5.3 Separate execution success from evidence success.** A click can
      succeed while the required screenshot fails.
      `verify:` that fixture reads `degraded` or `unverified`, never `success`.

- [ ] **5.4 Add the lifecycle and cleanup result.**
      `verify:` orphaned session or resource state is visible in the envelope,
      and the process tree is empty after the command exits.

## Phase 6 — Failure taxonomy, equivalent fallback, and the parked autonomy classes

- [ ] **6.1 Normalize the failure set** — `adapter_unavailable`,
      `adapter_unhealthy`, `adapter_undispatchable`, `capability_missing`,
      `launch_failed`, `navigation_failed`, `target_not_found`,
      `target_ambiguous`, `auth_required`, `network_blocked`,
      `evidence_incomplete`, `timeout`, `policy_denied`, `backend_bug`.
      `verify:` every fixture failure maps to exactly one member, and an
      unmapped failure fails the test rather than defaulting.

- [ ] **6.2 Map only safe equivalent fallbacks.** Implementation, transport or
      runtime may change while autonomy class, cost class, trust boundary,
      evidence completeness and authentication scope are preserved.
      `verify:` a fixture attempting `local -> paid remote` is refused as an
      ordinary retry and requires its own gate.

- [ ] **6.3 Add the transition and attempt ceiling.**
      `verify:` no fixture can construct an infinite fallback cycle; the ceiling
      is asserted by a test, not by inspection.

- [ ] **6.4 Adopt the deterministic autonomy class only; park the other two.**
      Adopted: `autonomy_class: deterministic` across all three resolution
      sources (`direct`, `discovered`, `cached`) — the draft's L0-L2, in the
      vocabulary v2 replaced them with. Parked: `semantic-single-step` and
      `agentic-subflow` (the draft's L3-L5), behind an explicit
      federation-shaped decision, **not** as an experimental tier.
      `verify:` the manifest schema rejects an adapter declaring a non-
      deterministic autonomy class, and blocker
      `b-adr-088-external-runtime-federation` reads open until that decision
      exists.

## Phase 7 — The runtime instruction contract

- [ ] **7.1 Support version-bound invocation instructions.** Candidate sources:
      an adapter-owned machine-readable schema, versioned `--help`, or a
      runtime-served tool help surface.
      `verify:` an instruction set is bound to an adapter version hash, and a
      version change invalidates it.

- [ ] **7.2 Treat external instructions as untrusted invocation data.** They may
      describe commands; they never override governance, safety, cost policy,
      evidence acceptance, merge authority, user intent or suite precedence.
      `verify:` a fixture whose help text contains an instruction-shaped
      directive is quarantined and surfaced, never executed.

- [ ] **7.3 Cache by adapter version hash and detect drift.**
      `verify:` a drifted adapter version produces a cache miss and a recorded
      drift event, not a stale hit.

## Phase 8 — Outcome telemetry, and no learning broker

The draft proposed a four-rung ladder ending in a bounded tie-break. Two rungs
land; two are parked. No defect in the tree names an outcome-learning broker,
and the weighted-fitness engine the analysis companion already rejected is
corroborated by the budget-routing retirement in § Context.

- [ ] **8.1 Record outcomes by adapter, version, host and task profile.**
      `verify:` a run appends one validated line per dispatch, and the record
      carries no free-form field capable of holding a prompt, a file body or a
      path.

- [ ] **8.2 Report reliability and cost distributions.**
      `verify:` the report is reproducible from the recorded lines alone.

- [ ] **8.3 Park the shadow-recommendation and broker-fitness-scoring rungs as
      null-until-need.**
      `verify:` no code path scores an adapter, and the park is recorded with the
      demand signal that would reopen it — a named defect, never two models
      suggesting it.

## Phase 9 — The generalization gate

Do not expand because capability names are cheap to invent.

- [ ] **9.1 Hold generality until every condition holds.** The browser vertical
      passes; at least two interchangeable transports pass one contract;
      fallback and evidence semantics are stable; one second non-browser domain
      with a **real recorded defect** and two actual implementations
      demonstrates the same abstraction; context and runtime cost stay inside
      suite budgets.
      `verify:` each of the five conditions has a citable artifact; a missing
      citation blocks the graduation rather than being argued around.

## Blockers

### blocker: b-reach-channels-precedent
- **Status:** open
- **Owner:** AI council
- **Blocks:** Phase 0 Step 0.3, and transitively Phase 2 (no adapter manifest is
  authored before this is answered).
- **What to do:**
  1. Read `src/config/reach-channels.yml` (217 lines), its schema, and
     `src/scripts/reach_doctor.ts` (1651 lines). Together they already implement
     a capability-to-ordered-backend-candidates manifest with health probes and
     pinned installs — in another domain.
  2. Read that work's own recorded outcome: its Phase-0 pre-registered benchmark
     returned **`band: stop`** (native arm 12/12, reach arm 0 outright wins), so
     no router skill ships and no channel is routed, preferred, or suggested to
     an agent. The header also records the design intent that "BACKEND ORDER IS
     THE SWITCH... never editing code" — which is this roadmap's Phase 4 in
     another vocabulary.
  3. Read the second instance of the same shape:
     `agents/roadmaps/later/road-to-policy-evaluation-core.md`. Its gate (1)
     fired **against** the roadmap, and a 2026-07-28 council read the resulting
     null's root cause as a **category limit, not a bug**, recommending the
     roadmap be treated as approach-invalidated rather than unblocked.
  4. State what property of the browser vertical makes it not that result a
     third time. Candidate properties: the backends are genuinely
     interchangeable on one protocol; the evidence contract is numeric and
     byte-comparable rather than a retrieval ranking; a caller exists in Phase 3
     before the selector.
- **Recommendation:** answer it as a scoped distinction, not as a dismissal. The
  reach result is strong evidence about *retrieval* backends and weak evidence
  about *deterministic artifact producers* — but that distinction has to be
  stated and defended before the manifest is written, not after.
- **If you do nothing:** the third instance of a pre-registered manifest-plus-
  probe benchmark returns `stop`, and the roadmap discovers it in Phase 3 after
  Phases 1 and 2 are built.
- **Resolved when:** a dated council disposition names the transferable and
  non-transferable parts of the reach outcome, and Phase 0 Step 0.3's verify
  passes.

### blocker: b-requires-key-reserved
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 0 Step 0.1, and transitively Phase 1.
- **What to do:**
  1. Read `src/scripts/schemas/skill.schema.json:45-89`. `runtime_requires`
     exists, is probeable, and is unused by any skill.
  2. Read the same schema's statement that `requires` is reserved for ADR-015
     pack-dependency edges, validated in `build_discovery_manifest.ts`, and that
     reusing it makes every skill carrying one unassignable in the discovery
     manifest.
  3. Decide: extend `runtime_requires` with a capability member, or name a third
     key deliberately with the collision reason recorded in the schema
     `$comment` the way the existing one is.
  4. Resolve the second collision in the same pass: the draft's generated root
     `CAPABILITIES.yaml`.
- **Recommendation:** extend `runtime_requires`. It is already the declared
  machine-readable prerequisites object, it is unused so there is no migration,
  and a third key would need its own reservation note explaining why two were
  not enough.
- **If you do nothing:** Phase 1 lands `execution.requires:`, and every skill
  carrying one becomes unassignable in the discovery manifest — the exact
  failure the schema documents.
- **Resolved when:** the chosen key exists in exactly one schema, is validated,
  and `CAPABILITIES.yaml` is either dropped or renamed away from the collision.

### blocker: b-adr-042-runtime-resolver
- **Status:** open
- **Owner:** AI council
- **Blocks:** Phase 0 Step 0.2, and transitively Phase 4.
- **What to do:** read `docs/decisions/ADR-042-runtime-resolver-decision-gate.md`
  (`status: accepted`) — "**STOP.** Do not build a runtime pack resolver now",
  converged 3-round council 2026-06-03, on the grounds that a runtime resolver
  crosses a new config-to-execution trust boundary and adds a context-window tax
  with no evidence the problem exists. Then state whether an adapter selector
  for `browser.*` is inside that decision's scope. The ADR's own refinement is
  the discriminator: only an **execution-gating** need — implementations
  genuinely *unavailable*, not merely de-prioritised — would justify a resolver.
- **Recommendation:** argue it as outside scope on the execution-gating ground,
  since an undispatchable browser adapter is unavailable rather than
  de-prioritised — but argue it explicitly, and cite the ADR's re-trigger
  condition rather than asserting non-overlap.
- **If you do nothing:** Phase 4 builds a resolver against a live accepted STOP.
- **Resolved when:** a dated disposition records in-scope or out-of-scope with
  the ADR's own discriminator applied.

### blocker: b-adr-212-declarative-routing
- **Status:** open
- **Owner:** AI council
- **Blocks:** Phase 0 Step 0.2, and transitively Phase 4.
- **What to do:** read
  `docs/decisions/ADR-212-declarative-routing-with-quantified-resolver-reopen.md`
  (`status: accepted`) — rule routing stays declarative, the layer-1 resolver was
  evaluated and **not built**, and the reopen is deterministic and quantified
  (>= 30 % of tier-2 rules failing their matrix floor), with the explicit
  consequence that "the resolver question stops recurring conversationally".
  State whether adapter selection is the same resolver class as rule routing.
- **Recommendation:** they are different subjects — that ADR governs which
  *rules* reach a session; this governs which *implementation* satisfies a
  declared capability. But ADR-212's closing consequence exists precisely to stop
  a resolver being re-proposed under a new name, so the distinction has to clear
  that bar in writing.
- **If you do nothing:** Phase 4 is the conversational recurrence ADR-212 closed.
- **Resolved when:** a dated disposition states the class distinction and
  confirms the quantified reopen is untouched by this work.

### blocker: b-adr-088-external-runtime-federation
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 6 Step 6.4's parked half. Phases 0-5 and 7-9 proceed.
- **What to do:** read `docs/decisions/ADR-088-no-external-runtime-federation.md`
  (`status: accepted`) — this package "does not bridge to, or drive, external
  tool runtimes", stated as a **category** boundary, and "federation is a
  separate, explicit decision" requiring its own ADR. Then classify:
  1. The four adopted adapters drive browser **engines**, not external agent
     runtimes, so the deterministic class is argued as outside the boundary.
  2. `semantic-single-step` and `agentic-subflow` delegate decisions to external
     AI runtimes. That is inside the boundary, and it also touches
     orchestrator-only doctrine plus billing and network governance.
- **Recommendation:** keep the parked classes parked. Promoting them needs its
  own ADR answering ADR-088's questions, and it is owner-reserved: it creates an
  external, billable, network-crossing commitment.
- **If you do nothing:** a `semantic-single-step` adapter lands as
  "experimental" and the category boundary is crossed without the ADR ADR-088
  requires.
- **Resolved when:** a disposition records the deterministic class as outside the
  boundary with its reason, and the two parked classes as gated on a named
  federation ADR that does not yet exist.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Third `band: stop` on a manifest-plus-probe benchmark | product | Two prior instances of this exact shape returned a null read as a category limit rather than a bug — the reach benchmark and the policy-evaluation core. A third would spend Phases 1-2 to learn it. | Blocker `b-reach-channels-precedent` is answered before any adapter manifest is authored, and must name a non-transferable property rather than dismiss the precedent. | Phase 0 — Step 0.3 |
| 2 | A second parallel router lands beside three existing primitives | implementation | `tool_probe.ts`, `reach_doctor.ts` and `judgment_ladder.ts` already carry the probe taxonomy and the priority-ordered resolver. A new module re-deriving them is the fourth classifier the ladder's own header forbids. | Step 0.4 requires a table naming each primitive with extend-or-not and a reason; the manifest schema is forbidden from re-declaring `ToolProbeStatus`/`ChannelStatus`. | Phase 0 — Step 0.4 |
| 3 | Selector built before its caller | implementation | The retired budget-routing contract is the measured instance: acceptance criteria pre-registered against a mechanism with no production caller, `session_tier` non-null in 0 of 327 records, dead code still in the tree. | Phase 3 precedes Phase 4 by construction, and 4.4's empirical tie-break can only consume Phase 3 measurements. | Phase 3 — before Phase 4 |
| 4 | The `requires` collision reaches the manifest | implementation | The schema states that reusing `requires` makes every skill carrying one unassignable in the discovery manifest, so the collision is silent at authoring time and structural at build time. | Blocker `b-requires-key-reserved` gates Step 0.1; Step 0.1's verify greps the reservation and asserts no new top-level `requires`. | Phase 0 — Step 0.1 |
| 5 | Autonomy escalation arrives as an experiment | product | A `semantic-single-step` adapter labelled experimental crosses ADR-088's category boundary, adds billing and network governance, and is hard to withdraw once a consumer depends on it. | Step 6.4 adopts only the deterministic class; the schema rejects a non-deterministic autonomy class while `b-adr-088-external-runtime-federation` is open. | Phase 6 — Step 6.4 |
| 6 | Capability namespace grows past its consumers | product | Capability names are cheap to invent, so the namespace outgrows the adapters that implement it and the roadmap reads as broader coverage than it has. | Step 1.1's verify fails a capability with no consumer call site or no implementing adapter; Phase 9 blocks generality on five citable artifacts. | Phase 1 — Step 1.1 |
| 7 | Evidence degradation reported as parity | product | An adapter that produces a screenshot but no console evidence can be recorded as satisfying the contract, which makes the whole benchmark unreliable in the direction that flatters it. | Step 5.3 separates execution success from evidence success with a fixture asserting `degraded`, never `success`; Step 3.4 publishes nulls against the 0.6 bar set. | Phase 5 — Step 5.3 |

## Acceptance Criteria

- [ ] AC-1 — A frontend workflow requests browser capabilities without naming a
      backend in any required position, and the vendor-coupling lint of Step 1.4
      is green on the tree.
- [ ] AC-2 — The declaration lands on the key resolved by
      `b-requires-key-reserved`, and no new top-level `requires` exists in any
      schema.
- [ ] AC-3 — Available, healthy and dispatchable are distinguishable states,
      expressed as members of the extended `ChannelStatus` enum rather than as a
      parallel boolean object.
- [ ] AC-4 — All four proving adapters — project Playwright, playwright-cli,
      Playwright MCP, agent-browser — validate against one manifest schema.
- [ ] AC-5 — At least two dispatchable adapters satisfy one browser evidence
      contract on the same frozen fixture, published with the 0.5 digest.
- [ ] AC-6 — The advertised-but-undispatchable fixture is refused before
      execution, in both the probe (2.4) and the pilot (3.5).
- [ ] AC-7 — Selection is a fixed priority order with no numeric weight anywhere
      in the decision path, and every selection emits reason codes sufficient to
      explain it.
- [ ] AC-8 — Phase 3's measurements exist and are published before any Phase 4
      empirical tie-break can fire; the no-data path is deterministic.
- [ ] AC-9 — Fallback cannot silently widen trust, cost, autonomy or evidence
      scope, and no fixture can construct an infinite fallback cycle.
- [ ] AC-10 — Runtime-loaded tool instructions are version-bound, drift-detected,
      and cannot override governance; an instruction-shaped directive in help
      text is quarantined.
- [ ] AC-11 — Telemetry records and reports only. No code path scores an
      adapter, and the parked scoring rungs name the defect that would reopen
      them.
- [ ] AC-12 — Only `autonomy_class: deterministic` ships. The two escalation
      classes stay gated on a federation ADR that does not yet exist.
- [ ] AC-13 — Generality beyond `browser.*` is blocked until Phase 9's five
      conditions each have a citable artifact.
- [ ] AC-14 — All five blockers read `Status: resolved` before any code in
      Phases 1-9 is authored.

## Corrections applied at landing (2026-08-24)

| What | Source draft | Landed as | Why |
|---|---|---|---|
| **Phase order** | Selector (Phase 3) before frontend pilot (Phase 5) | Pilot is Phase 3; selector is Phase 4 | `docs/contracts/budget-routing.md` was RETIRED 2026-08-16 by a 2-of-2 council because AC1-AC5 were "pre-registered against a mechanism with no production caller and no possible measurement basis, so they could never fire". `session_tier` was non-null in **0 of 327** records and `src/scripts/_lib/tier_budget_routing.ts` is still dead code. Building a selector before its caller is that failure by name. |
| Phase 1 anchor | A new `execution.requires:` field | Extends `runtime_requires`, per blocker `b-requires-key-reserved` | `src/scripts/schemas/skill.schema.json:45-89` already defines a probeable top-level `runtime_requires` with `bins`/`env`/`primary_env`/`network`, unused by any skill. The declarative surface ships; only the semantic layer above named binaries is missing. |
| `requires` as a key name | Proposed `execution.requires:` | Named as a merge-blocking collision, gated in Phase 0 | The same schema reserves `requires` for ADR-015 pack edges validated in `build_discovery_manifest.ts`, and states that reusing it makes every skill carrying one unassignable in the discovery manifest. The generated root `CAPABILITIES.yaml` is the second collision. |
| Phase 2 anchor | A new 7-field `dispatchable` boolean object | Extends the existing 7-state enum | `tool_probe.ts:59` ships `ToolProbeStatus` (5 states, hardened spawn, retry only on timeout, never throws); `reach_doctor.ts:104-110` extends it to `ChannelStatus` (7 states) so `missing` and `not-ready` are distinguishable. The draft cites neither file. |
| Selector anchor | No precedent cited | Cites `src/scripts/_lib/judgment_ladder.ts` | Its header states that the fixed priority order *is* the contract, so two signals matching the same text resolve deterministically. That is the precedent for an ordered filter over a weighted score. |
| Autonomy ladder | v1's L0-L5; v2 replaced it with three `autonomy_class` values | Adopt `deterministic` across all three resolution sources; park `semantic-single-step` and `agentic-subflow` behind a federation-shaped decision | **Vocabulary mismatch, recorded not papered over:** the landing brief specified "adopt L0-L2, park L3-L5", which is v1 vocabulary (`road-to-capability-native-execution.md:159-163` defines L0-L2 as deterministic action, deterministic discovery, cached action). v2 had already decomposed that ladder because it conflated caching with autonomy. The instruction is applied through v2's own axes; the mapping is stated so a reader can check it. |
| Semantic escalation | Phase 7, conditional "only if earned" | Folded into Step 6.4 and gated on `b-adr-088-external-runtime-federation` | ADR-088 states a **category** boundary and that "federation is a separate, explicit decision" needing its own ADR. "Only if earned" is a benchmark condition; this needs an authorization decision, and it is owner-reserved. Not shipped as an experimental tier. |
| Adapter set | Three (project Playwright, CLI, MCP) | Four, with agent-browser experimental; Stagehand and Browser Use excluded | The two excluded backends are semantic/agentic and fall under the parked autonomy classes, so admitting them would cross the ADR-088 boundary through the adapter list. |
| Outcome learning | Four-rung ladder ending in a bounded tie-break | Two rungs land (record, report); shadow recommendation and broker fitness scoring parked null-until-need | No defect in the tree names an outcome-learning broker. The weighted-fitness engine the analysis companion rejects is independently corroborated by the budget-routing retirement above. |
| Precedent blocker | None | `b-reach-channels-precedent` (owner: AI council) | `src/config/reach-channels.yml` (217 lines) + `reach_doctor.ts` (1651 lines) already implement a capability-to-ordered-candidates manifest with health probes in another domain, and its pre-registered benchmark returned **`band: stop`**. `later/road-to-policy-evaluation-core.md` is the second instance, where a council read the null as a category limit rather than a bug. |
| ADR classification | Assumed non-overlap | Three blockers, one per ADR (042, 212, 088) | Each is `status: accepted` and each has a discriminator the roadmap must apply rather than assert: ADR-042's execution-gating test, ADR-212's "the resolver question stops recurring conversationally", ADR-088's category boundary. |
| Risk table shape | No risk section | `## Risk Register` with the six-column house grammar and the `risk-review` marker | `src/scripts/lint_plan_risk_register.ts` requires the exact six-cell header; `Risk type` admits only `product` or `implementation` (`:288-293`). |
| Missing house sections | No `## Goal`/`## Context` in house shape, no Source line, no `## Blockers` | All present; every step carries a `verify:` line | House roadmap contract. |
| Frontmatter | `supersedes:` a file that is not in the tree | `estate_offset_exempt` with the offset-unavailability reason; `supersedes:` dropped | Nothing named in `supersedes:` exists under `agents/roadmaps/`, so the key would point at nothing. The one-in-one-out half fires on every added `road-to-*.md` whatever its status, and this run archived only `status: draft` roadmaps, which `collect()` never counted. |
| Landing HEAD | Pinned `d7072e910` (2026-08-23) | Anchors re-verified at worktree HEAD `fb06b65f1` | The pin is a day old and the landing worktree is not at the HEAD the brief named (`0f7c26ee9`); every file:line cited above was re-read at `fb06b65f1`. |
| Frontend consumer | `depends_on` a v2 frontend roadmap | No `depends_on`; the consumer's surviving phases are registered in two existing stubs | The frontend Draft C does not land. `agents/roadmaps/stubs/road-to-frontend-power-live-measurements.md` already carries its tiering phases as E1.5 and `stubs/road-to-frontend-power-detector-promotions.md` already carries its detector phases as E3.3, both verbatim and both with named producers. |
