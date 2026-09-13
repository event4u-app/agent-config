---
type: "auto"
tier: "1"
description: "A behavior change gets a failing test first — and the test must fail for the intended reason before any implementation is written"
triggers:
  - keyword: "tdd"
  - keyword: "test-first"
  - keyword: "failing test"
  - keyword: "regression test"
  - keyword: "characterization test"
routes_to:
  - "skill:test-driven-development"
enforced_by:
  - "instruction-only: no gate sees which was written first; check_test_delta and check_test_weakening catch an absence, never an order."
obligation_frequency: "per-edit"
workspaces: [agent-config-maintainer, engineering]
packs: [engineering-base]
---

# Test First

```
A BEHAVIOR CHANGE GETS A FAILING TEST FIRST, WHERE A TEST IS MEANINGFUL.
A BUG GETS A REPRODUCING REGRESSION TEST FIRST.
UNCERTAIN LEGACY GETS A CHARACTERIZATION TEST FIRST.
THE TEST MUST FAIL FOR THE INTENDED REASON — A TEST NEVER SEEN RED HAS
UNKNOWN SENSITIVITY AND IS NOT EVIDENCE. REFACTOR ONLY AFTER GREEN.
```

[`test-driven-development`](../skills/test-driven-development/SKILL.md) carries the
procedure; this rule decides **when** it is owed: for consumer code, for this
package's own code, scripts and hooks, **and for governance changes whose
projection, routing or lint behavior is testable** — the clause a reader escapes
with *the artifact is markdown, so there is nothing to test*. Markdown is not the
discriminator: a rule whose triggers decide what loads, a projection a gate reads and a lint whose verdict flips are executable contracts in a prose extension.

**Where there is genuinely no executable contract** — a paragraph stating a
reason — the obligation is an independent *review*, never a fake test: an
assertion over prose written to satisfy this rule manufactures the evidence it exists to require.

**Does NOT fire on** a rename, typo, formatting or comment-only edit · a change the user fenced this turn · a spike deleted before it lands.
