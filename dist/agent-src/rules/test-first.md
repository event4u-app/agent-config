---
type: "auto"
tier: "1"
description: "A behaviour change gets a failing test first — and the test must fail for the intended reason before any implementation is written"
alwaysApply: false
self_contained: false
routes_to:
  - "skill:test-driven-development"
enforced_by:
  - "instruction-only: no gate sees which was written first; the test-delta and test-weakening gates catch an absence, never an order."
obligation_frequency: "per-edit"
---

# Test First

```
A BEHAVIOUR CHANGE GETS A FAILING TEST FIRST, WHERE A TEST IS MEANINGFUL.
A BUG GETS A REPRODUCING REGRESSION TEST FIRST.
UNCERTAIN LEGACY GETS A CHARACTERISATION TEST FIRST.
THE TEST MUST FAIL FOR THE INTENDED REASON — A TEST NEVER SEEN RED HAS
UNKNOWN SENSITIVITY AND IS NOT EVIDENCE. REFACTOR ONLY AFTER GREEN.
```

[`test-driven-development`](../skills/test-driven-development/SKILL.md) carries the
procedure; this rule decides **when** it is owed. It applies to consumer code, to
this package's own code, scripts and hooks, **and to governance changes whose
projection, routing or lint behaviour is testable**.

That last clause is the one a reader tries to escape: *the artefact is markdown,
so there is nothing to test*. Markdown is not the discriminator. A rule whose
triggers decide what loads, a projection whose output a gate reads and a lint
whose verdict flips are executable contracts in a prose extension, each with a
test that fails before the change and passes after.

**Where there is genuinely no executable contract** — a paragraph stating a
reason — the obligation is an independent *review*, never a fake test. An
assertion over prose written to satisfy this rule manufactures the evidence the
rule exists to require.

**Does NOT fire on** a rename, typo, formatting or comment-only edit · a change the user fenced this turn · a spike deleted before it lands.
