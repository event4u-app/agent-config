---
type: "auto"
tier: "2b"
description: "Before coding/modifying/debugging — analyze first, verify with real tools, never guess or trial-and-error"
alwaysApply: false
load_context:
  - ../contexts/communication/rules-auto/think-before-action-mechanics.md
triggers:
  - phrase: "before coding"
  - phrase: "before debugging"
  - phrase: "before modifying"
  - keyword: "implement"
  - keyword: "debug"
  - keyword: "refactor"
  - keyword: "fix"
  - keyword: "optimize"
self_contained: true
workspaces: [engineering]
packs: [engineering-base]
collision_ok:
  "refactor": "analyze-before-modify floor fires on any refactor"
  "implement": "analyze-first floor on any implementation"
  "debug": "targeted inspection over brute force while debugging"
  "fix": "no blind trial-and-error on fixes — max 2 retries"
# obligation: line 50
obligation_frequency: "per-edit"
---

# think-before-action

## The Iron Law

```
ANALYZE BEFORE CODING. VERIFY WITH REAL TOOLS. NEVER GUESS.
NO BLIND TRIAL-AND-ERROR. MAX 2 RETRIES PER APPROACH.
```

- Always analyze before coding or modifying anything.
- **External or expensive structure in the read set** (DB schema, API/GraphQL shape, vendor-package surface, an unconfirmed DTO/Model/Entity) → discover the real source and emit an Evidence Report **before** planning, per [`source-discovery`](source-discovery-gate.md). No structural claim without evidence.
- Never guess behavior — verify using code, data, or tools.
- Prefer targeted inspection (jq, debugger, logs) over brute-force.
- Always verify results after changes (API, UI, tests) using the concrete tool that exercises that surface — `curl` / Playwright / browser for HTTP and UI, debugger / `xdebug` for runtime frames, the project's test runner for behavior.
- **Behavior-changing work is test-first by default, not by preference.** One
  behavior at a time: the test written, **observed failing**, then the minimum
  code that makes that one behavior pass. The only exceptions are the
  *Do NOT use when* list in [`test-driven-development`](../skills/test-driven-development/SKILL.md)
  — do not restate them here and do not extend them inline. Going code-first
  outside that list is an **override, and an override is recorded**: name the
  behavior and the reason in the reply and in the decision log. A silent
  code-first pass is the failure this line exists to stop, not a style choice.
- **Multi-step task → restate as verifiable success criteria first** (test that reproduces the bug, failing-then-passing check, before/after invariant) and plan `step → verify:` per step; a task whose success cannot be checked is a clarification trigger, not an execution trigger. Transformation table: [`think-before-action-mechanics § Goal-driven execution`](../contexts/communication/rules-auto/think-before-action-mechanics.md#goal-driven-execution--vague-ask--verifiable-goal).
- Unclear requirements → precise clarification question, not hidden assumptions.
- Refactors must preserve behavior, validation, examples, and anti-failure guidance unless explicitly changed.
- Do NOT modify code you do not fully understand — read it, trace the flow, then change it.
- Multiple valid frameworks/patterns coexist (Tailwind + Flux, multiple form libs, competing state stores) → do NOT pick one silently — ask. See [`no blind implementation`](../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#2-no-blind-implementation).

## The intent line, before a behavior-changing edit

Before an edit that changes behavior, emit the **intent line**: what the code
does · what the failing check expects · what the specification says. When the
three disagree, the disagreement is the finding and the edit does not proceed.
Shape, the other four mandated lines, and the pre-send sweep:
[`mandated-lines`](../contexts/execution/mandated-lines.md).

## Where the answer lives — and saying so when it lives nowhere

Route by **where the answer actually is**: the code, a config, a live probe, a
doc, the user. When the answer exists only in your own inference — nothing to
open, nothing to run, nobody to ask — **say that**, in the report, in one clause.

```
AN INFERENCE DRESSED IN PROCESS IS INDISTINGUISHABLE FROM A LOOKUP.
NAME THE DETOUR. A SILENT DETOUR READS AS A SKIPPED STEP.
```

This rule and its neighbours say *be rigorous* often enough that the costume
version — narrating a thorough-sounding procedure over a guess — is a live risk
here specifically. The cost of naming it is one clause; the cost of not naming
it is that a reader cannot tell a verified fact from a confident one, which is
the property the whole evidence discipline exists to protect.

## Mechanics — workflow, minimum read set, verify-with-real-tools, no blind retries

The five-step Understand → Analyze → Plan → Implement → Verify workflow, the minimum read set (symbol, callers, tests, abstractions, data), the memory-consult step, the verification matrix, the output-reduction patterns, the no-blind-retries protocol, and the "open files are context, not intent" clause all live in [`contexts/communication/rules-auto/think-before-action-mechanics.md`](../contexts/communication/rules-auto/think-before-action-mechanics.md). The rule above is the obligation surface; the mechanics file is the lookup material.

If analysis is skipped → results are unreliable.

## Environment grounding (RDP)

On a vague or long-horizon task, ground before designing: enumerate the
constraints, available tools, and information gaps, then **close the gaps by
query/test** before proposing a solution — don't design against assumptions.
Engage per [`rdp-gate`](../contexts/execution/rdp-gate.md) (skip on trivial
tasks; light touch on a strong-reasoning host).

**Ground the harness, not just the code.** Beyond structural facts (schema, API,
DTO — the `source-discovery-gate`), ground the *runtime harness* before acting:
which tools and host capabilities are actually available, whether a native effort
knob exists, and whether the credentials / permissions the task needs are present.
A task that assumes a tool or credential it never confirmed is designing against
an assumption exactly as a hallucinated field is — a missing-capability discovery
is cheaper before the first action than after a failed one. (A native-harness
behavior on the strongest host; made explicit here so it holds on every host this
package projects to.)
