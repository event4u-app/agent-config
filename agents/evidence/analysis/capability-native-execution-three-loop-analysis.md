<!-- Landed by the /analyze:inbox run of 2026-08-24. -->

> **This is an evidence artefact, not estate.** It lives under
> `agents/evidence/analysis/` and charges nothing against the roadmap estate: it
> plans no work, carries no phases, no blockers and no acceptance criteria, and
> nothing verifies against it. It is the analysis companion that restructured the
> capability-native execution roadmap set on 2026-08-23, retained because the
> reasoning behind that restructure is not reconstructible from the roadmap that
> survived it. The roadmap it produced landed as
> `agents/roadmaps/road-to-capability-native-execution.md` (`status: draft`).
>
> **One of its conclusions is independently corroborated, and worth flagging
> before you read it.** The document rejects a weighted multi-factor scoring
> engine for adapter selection in v0. That rejection was reasoned rather than
> measured when it was written. It is now backed by a measurement from a
> different domain: `docs/contracts/budget-routing.md` was **RETIRED 2026-08-16**
> by a converged 2-of-2 AI council, on the grounds that its acceptance criteria
> "were pre-registered against a mechanism with no production caller and no
> possible measurement basis, so they could never fire" — with `session_tier`
> non-null in **0 of 327** orchestration records and
> `src/scripts/_lib/tier_budget_routing.ts` left in the tree as dead code. That
> is the same failure shape this document argues against, arrived at from the
> opposite direction, and it is why the landed roadmap moved the frontend pilot
> ahead of the selector rather than merely dropping the weights.
>
> Source: `agents/tmp.old/nxt-lvl-frontend/capability-native-execution-three-loop-analysis.md`.
> Body below is unchanged from that file.

---

# Three-loop re-analysis — capability-native execution and frontend evidence

**Date:** 2026-08-23  
**AC pin re-verified:** `d7072e910d0478814358cca576eef585c3a04bfc`  
**Input set:** current chat, capability-native execution roadmap, deterministic frontend evidence roadmap, frontend intelligence/taste/browser-evidence roadmap, handling note.

> This document is an analysis companion, not an implementation roadmap.
> It records why the roadmap set was restructured after three new challenge loops.

## Executive result

The previous work reached the right architectural principle but left too many overlapping plans alive at once.

The corrected structure is:

1. **`road-to-capability-native-execution-v2.md`** — the generic execution owner.
2. **`road-to-deterministic-frontend-evidence-v2.md`** — the first consumer and proving vertical.
3. The broad frontend-intelligence roadmap becomes **research input / later-candidate source**, not a third competing execution owner.
4. The existing handling note remains **NOT FOR THE TRACKED TREE** and continues to carry the confidential source mapping.

The largest conceptual changes are:

- browser-first vertical slice before universal capability ontology;
- no weighted “17-factor” scoring engine in v0;
- availability is not enough — an adapter must be **dispatchable**;
- autonomy, discovery source, cache state, transport and runtime are separate axes;
- semantic/agentic browser backends are escalation capabilities, not default peers;
- the frontend evidence roadmap no longer directly installs or prefers one browser backend before the broker proves the route;
- design-system extraction remains deferred until the existing frontend enforcement path produces a consumer signal;
- generic expansion beyond browsers requires proof in the browser vertical plus one second domain.

---

# Baseline reconciliation

## What the current files already got right

The capability-native roadmap correctly states the central rule:

> domain skills describe capabilities/evidence, not concrete tools.

It also correctly separates control plane from execution plane, transport from capability, and makes missing-tool handling subordinate to “can this capability already be satisfied another way?”

The deterministic frontend evidence roadmap is much stronger as an implementation basis because it starts from defects confirmed against the AC tree:

- no deterministic browser evidence rail;
- rendered comparison lacks per-element numeric evidence;
- detector coverage has a measured delta;
- detector execution is single-tier despite Stop support;
- corpus pin needs selective refresh;
- design-system extraction is currently write-only.

It also has clean ownership boundaries with existing frontend-power, fidelity and skill-delivery work.

The broad frontend-intelligence roadmap is valuable as research synthesis, but many of its phases now overlap either:
- already-existing AC features, or
- work assigned more precisely by the deterministic roadmap, or
- the new generic capability owner.

That makes it better as a harvested design document than as another active roadmap.

---

# Loop 1 — Collapse overlapping ownership

## Question

Do three active roadmaps improve execution, or do they now create competing ownership?

## Problems found

### 1. Two browser resolvers

The broad frontend roadmap still defines a browser resolver with a default candidate order.

The capability-native roadmap later rejects a static priority list and proposes task-aware selection.

Both cannot own browser selection.

### 2. Two evidence owners

The broad frontend roadmap defines `browser_evidence.json` and a measurement sheet.

The deterministic frontend evidence roadmap already identifies the exact missing rendered-side producer and explicitly hands its output to the fidelity roadmap.

The latter has the cleaner ownership boundary.

### 3. Extraction timing conflict

The broad frontend roadmap wants design observation/extraction as an early core phase.

The deterministic roadmap deliberately parks extraction under `later/` until the frontend-power intervention arm produces signal, because extraction has no proven consumer while enforcement remains off.

The tree-grounded decision wins.

### 4. Corpus work is already mostly done

The current tree already carries the design-intelligence/corpus-grounding substrate. The remaining work is selective pin-refresh/audit, not building an intelligence layer from zero.

### 5. Generic router vs frontend-local router

Once AC has a generic execution broker, a frontend-only resolver becomes duplicate architecture.

## Loop 1 decision

### Keep

**Capability-native roadmap**
- generic contract;
- adapter discovery;
- selection;
- fallback;
- normalized execution evidence.

**Deterministic frontend evidence roadmap**
- rendered measurement vertical;
- two-tier detector economics;
- detector delta harvest;
- selective corpus refresh;
- deferred extraction spike.

### Demote from execution ownership

**Frontend intelligence/taste/browser-evidence roadmap**
- retain as research synthesis;
- harvest intent/authority insights where not already owned;
- harvest pack/context-economy observations;
- do not execute its duplicate browser/evidence/corpus phases independently.

## Structural result

```text
Capability-native execution
    owns HOW AC chooses and invokes capabilities
                 │
                 ▼
Deterministic frontend evidence
    is first consumer proving browser execution/evidence
                 │
                 ▼
existing frontend-power / fidelity owners
    consume findings/evidence and decide enforcement/convergence
```

---

# Loop 2 — Challenge the broker for overengineering

## Question

Does the proposed capability broker solve today’s problem, or are we building a universal execution OS before proving one vertical?

## Problems found

### 1. Universal ontology too early

The old roadmap enumerates browser, web, HTTP, Git, DB, filesystem, code, image, design and testing capabilities.

That is useful directionally but dangerous as an implementation starting point.

A stable ontology should emerge from working adapters, not precede them by months.

### 2. Weighted scoring is premature

The old fitness vector includes roughly seventeen dimensions.

Problems:
- weight tuning becomes a hidden policy system;
- tiny changes can reorder adapters unexpectedly;
- sparse outcome data makes empirical weights unreliable;
- testing every combination becomes expensive;
- “best” becomes difficult to explain.

## Replacement: deterministic selection order

v0 should use:

```text
1. hard capability match
2. policy / trust / cost / privacy eligibility
3. host dispatchability
4. task-profile suitability
5. dominance rules
6. measured reliability/context-cost tie-break
7. deterministic stable tie-break
```

No arbitrary numeric score is required.

Only after sufficient measured cases should a numeric model even be reconsidered.

### 3. Autonomy ladder mixes unrelated concepts

The old L0-L5 model combines:
- deterministic execution;
- discovery;
- cache reuse;
- semantic inference;
- agentic execution.

Caching is not an autonomy level.

Discovery is not necessarily autonomy.

## Replacement: orthogonal dimensions

### `autonomy_class`

```text
deterministic
semantic-single-step
agentic-subflow
```

### `resolution_source`

```text
direct
discovered
cached
inferred
```

### `transport`

```text
library
cli
mcp
host-native
connector
```

### `runtime`

```text
project
local
container
remote
managed
```

This allows combinations such as:

```text
autonomy: deterministic
resolution: cached
transport: cli
runtime: local
```

without inventing a new “level”.

### 4. Adaptive backends are being added before a demonstrated failure class

Stagehand-/Browser-Use-class adapters are useful, but they should not become required Phase-3 infrastructure merely because they exist.

Add an adaptive adapter only when the deterministic browser pilot records a repeatable failure class such as:
- target ambiguity;
- unstable DOM;
- semantic-only discovery need.

## Loop 2 decision

Start with a **browser capability vertical**, not a general broker framework.

Minimum viable broker:

```text
browser requirement
  -> discover adapters
  -> filter dispatchable adapters
  -> deterministic policy selection
  -> execute
  -> normalize evidence
  -> classify failure
  -> bounded fallback
```

Initial adapters should be the smallest set that proves interchangeability:
- existing project Playwright where available;
- Playwright CLI;
- Playwright MCP.

A fourth adapter is a generality test, not a prerequisite.

---

# Loop 3 — Challenge “available means usable”

## Question

If AC can detect a tool or host capability, is that sufficient to dispatch work to it automatically?

## New current-tree signal

The current AC drain evidence explicitly records the principle:

> “a host capability is not yet a safe dispatcher capability”

This is load-bearing for the new broker.

The old roadmap’s probe contract is therefore insufficient if it only says:

```json
{
  "available": true,
  "healthy": true
}
```

## Required distinction

An adapter needs separate states:

```text
installed
available
healthy
compatible
authorized
policy_allowed
dispatchable
```

### Example

An MCP browser server may:
- be discoverable;
- answer health probes;
- advertise screenshot support;

but still not be safely dispatchable because:
- the host cannot invoke it in the required execution lane;
- credentials/session scope are wrong;
- required confirmation semantics are unavailable;
- the adapter cannot return the evidence contract;
- the host strips or transforms required inputs;
- lifecycle cleanup cannot be guaranteed.

## Dispatchability contract

A candidate should only enter selection if AC can prove the invocation route.

Proposed probe result:

```json
{
  "adapter": "browser-x",
  "installed": true,
  "available": true,
  "healthy": true,
  "compatible": true,
  "authorized": true,
  "policy_allowed": true,
  "dispatchable": true,
  "capabilities": ["browser.navigate", "browser.screenshot"],
  "evidence_contract": "browser-evidence/v1",
  "probe_basis": "live|static|cached",
  "observed_at": "..."
}
```

A cached probe can inform discovery but should not automatically prove current dispatchability for high-risk operations.

## Failure/fallback rule refinement

The old roadmap correctly classifies failures, but fallback needs a stricter invariant:

> **Fallback may change implementation, transport or runtime without changing authority, trust boundary, cost class or evidence promise unless the governing policy explicitly permits that change.**

Therefore:
- CLI → MCP is often an ordinary equivalent fallback;
- local → paid managed browser is not;
- deterministic → semantic inference is an autonomy escalation and must be visible in evidence;
- screenshot+console → screenshot-only is evidence degradation, not success parity.

## Runtime instructions refinement

Runtime-loaded instructions remain a strong pattern, but must be limited to invocation knowledge.

They must never supply:
- AC governance;
- merge authority;
- cost policy;
- safety policy;
- evidence acceptance rules;
- user intent interpretation.

Those remain AC-owned.

## Learning refinement

Outcome history should initially be **telemetry**, not active ranking policy.

Promotion stages:

```text
record
 -> report
 -> shadow recommendation
 -> bounded tie-break
 -> only then possible ranking influence
```

This prevents feedback loops from sparse or host-specific data.

## Loop 3 decision

The broker’s central invariant becomes:

> **A capability is selectable only when it is both semantically suitable and operationally dispatchable under the current AC policy and evidence contract.**

---

# Final roadmap estate recommendation

## 1. Replace the old capability roadmap with v2

Reason:
- same architecture, much smaller first slice;
- dispatchability added;
- no premature universal ontology;
- no premature weighted scorer;
- no mixed autonomy ladder;
- explicit staged learning.

## 2. Replace the deterministic frontend evidence roadmap with v2

Reason:
- keep its tree-grounded defects and inverted-harvest discipline;
- make browser Phase A consume the capability broker instead of locally becoming a second router;
- preserve C-before-B economics;
- preserve corpus refresh;
- keep extraction in `later/`.

## 3. Do not run the broad frontend-intelligence roadmap as a third implementation plan

Recommended disposition:
- mark as superseded-by/research-input-to the two v2 roadmaps;
- retain its non-duplicate research findings;
- move unproven observation/extraction expansion to a later/stub route with an explicit promotion condition.

## 4. Keep the handling note outside the tree

The current handling note is correct:
- three harvested sources must remain anonymized in tracked artifacts;
- plain source mapping must not be committed;
- retained links follow AC’s encrypted-link mechanism.

---

# Final architecture after Loop 3

```text
USER / TASK
    │
    ▼
DOMAIN WORKFLOW
declares capability + evidence need
    │
    ▼
CAPABILITY REQUEST
tool-neutral
    │
    ▼
EXECUTION BROKER
    ├─ discover
    ├─ prove dispatchability
    ├─ apply policy/trust/cost constraints
    ├─ task-profile selection
    └─ deterministic tie-break
    │
    ▼
ADAPTER
project library | CLI | MCP | host-native | future
    │
    ▼
RUNTIME
project | local | container | remote
    │
    ▼
NORMALIZED EVIDENCE
backend + transport + runtime + autonomy + degradation
    │
    ▼
DOMAIN GATE
frontend fidelity / review / test / etc.
```

For uncertain interactions only:

```text
deterministic attempt
    ↓ classified semantic failure
semantic-single-step adapter
    ↓ produces a resolved action/ref
return to deterministic verification
```

Open-ended agentic browsing stays an explicit higher-autonomy capability, not the default repair mechanism.

---

# Success criteria after all three loops

The architecture is successful when:

- a frontend skill names no required browser vendor;
- the user normally chooses no browser plumbing;
- AC distinguishes capability availability from safe dispatchability;
- project Playwright, Playwright CLI and Playwright MCP can satisfy one evidence contract;
- selection is deterministic and explainable;
- one missing backend is invisible to the user when an equivalent dispatchable backend exists;
- semantic escalation occurs only after a classified deterministic failure;
- evidence records any autonomy/evidence/trust change;
- the deterministic frontend rail provides actual rendered numbers to fidelity owners;
- detector economics improve before detector coverage is widened;
- generic expansion is blocked until the browser vertical proves the abstraction;
- the broad frontend research work does not create a duplicate router, evidence schema or corpus owner.
