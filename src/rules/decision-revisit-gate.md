---
type: "auto"
tier: "2b"
description: "Beneficial change blocked by a lock (honest-null, don't-relitigate memory, budget canon, ADR) — surface a council re-evaluation offer, never drop"
alwaysApply: false
council_depth: deep
triggers:
  - intent: "blocked by prior decision"
  - intent: "revisit past verdict"
  - keyword: "don't relitigate"
  - keyword: "honest null"
  - keyword: "already decided"
  - keyword: "locked decision"
  - keyword: "budget blocks"
routes_to:
  - "skill:decision-review"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
---

# Decision Revisit Gate

## The Iron Law

```
A LOCK IS A DECISION UNDER PAST CONDITIONS, NOT A PERMANENT LAW.
BENEFIT BLOCKED BY A LOCK → SURFACE + OFFER RE-EVALUATION.
NEVER SILENT COMPLIANCE. NEVER SILENT DROP OF A GOOD CHANGE.
```

An agent that finds a genuinely beneficial change blocked by a recorded
past decision — an honest-null eval verdict, a "don't relitigate"
memory or context note, a token-frugality/budget canon line, or an ADR —
does not quietly comply and drop the change. It surfaces the conflict
and offers the user a path to re-evaluate the lock. Progress means
adaptation: locks encode what was true when they were written, not a
ceiling on what the package may ever become.

**Mechanism-match check comes FIRST**: a verdict settles the *mechanism it
tested*, not every future proposal that resembles it — if the blocked change
is a different mechanism, the lock does not apply; proceed, noting the
distinction.

Body migrated to [`skill:decision-review` § Decision-revisit gate — mechanics](../skills/decision-review/SKILL.md) (per P4 of `road-to-kernel-and-router.md`) — what-counts-as-a-lock catalog (honest nulls, don't-relitigate notes, budget-canon lines, ADRs, hard structural caps), the five fire steps, when-NOT-to-fire, failure modes.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`decision-review`](../skills/decision-review/SKILL.md) — the backward-audit
  procedure + the migrated gate mechanics.
- [`ai-council`](../skills/ai-council/SKILL.md) — the re-evaluation mechanism;
  owns the convergence-summary scope + `revisit-if` contract.
- [`decision-record`](../skills/decision-record/SKILL.md) — forward-flow decision
  locking; the escalation litmus there names the reopening condition up front.
- [`token-budget-discipline`](token-budget-discipline.md) — the frugality-canon
  value-over-budget escalation this rule's budget-lock case defers to.
- [`no-cheap-questions`](no-cheap-questions.md) — the question-quality floor a
  revisit-offer must still clear.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the numbered-options shape
  used to present the revisit offer.
