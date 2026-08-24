---
type: "auto"
tier: "2b"
description: "The same criticism arriving again indicts the system, not only the item — reopen the disposition that dismissed it, resolve on evidence, never on the repetition count"
alwaysApply: false
triggers:
  - phrase: "schon mehrfach"
  - phrase: "schon wieder"
  - phrase: "zum dritten mal"
  - phrase: "wie oft noch"
  - phrase: "wie oft soll ich"
  - phrase: "immer noch nicht"
  - phrase: "i already told you"
  - phrase: "told you this"
  - phrase: "how many times"
  - phrase: "as i mentioned before"
routes_to:
  - "guideline:agent-infra/recurring-criticism-mechanics"
  - "skill:skill-improvement-pipeline"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
collision_ok:
  "schon wieder": "active-remediation makes a user 'leave it' terminal against the AGENT re-raising a closed item; this rule fires only when the USER brings it back — a decision-maker reopening their own decision is not the nagging that rule prevents"
enforced_by:
  - "instruction-only: the earlier disposition, the three outcomes and the hardening are all prose; the self-repair occurrence counter covers only detector-matched defects"
obligation_frequency: "per-task"
---

# Recurring Criticism

[`decision-revisit-gate`](decision-revisit-gate.md) has one entrance: the agent
wants to act and a lock is in the way. This is the other — **the same criticism
arrives again**, from the user or from a re-arrived artifact.

## The Iron Law

```
THE SAME CRITICISM ARRIVING AGAIN IS EVIDENCE ABOUT THE SYSTEM,
NOT ONLY ABOUT THE ITEM.
REOPEN THE DISPOSITION THAT DISMISSED IT. NAME WHICH ASSUMPTION BROKE.
NEVER RESOLVE IT ON THE REPETITION COUNT — RESOLVE IT ON EVIDENCE.
CAPITULATING BECAUSE IT WAS SAID TWICE IS THE SAME FAILURE
AS DISMISSING IT TWICE.
A LEARNING THAT DOES NOT CONSTRAIN THE NEXT RUN IS NOT A LEARNING.
NEVER BUY A HARDENING BY WEAKENING A SAFETY FLOOR.
```

**The repetition reverses the burden of proof.** The standing rule is: same
mechanism, no new evidence → the lock applies. Recurrence *is* the new evidence —
not that the item is right, that the disposition did not hold. Whoever keeps the
lock now carries the argument. **Mechanism-match still runs first**: a complaint
resembling the old one but testing a different mechanism is a new finding.

**Resolve on evidence, never on the count.** Challenging a model's answer —
including a correct one — reliably makes it capitulate and revise toward the
perceived expectation rather than toward truth
<!-- harvest:reflection-sycophancy-flipflop -->, so a rule reading "said twice" as
proof of error would be that failure mode with a procedure attached. The
repetition opens the question; it never answers it.

## Exactly three outcomes

The repetition proves the **system** failed <!-- harvest:recurrence-indicts-the-system -->;
it does not prove the **decision** was wrong. Own analysis, from that split:

| Outcome | What actually broke | Hardening means |
|---|---|---|
| The disposition was **wrong** | the decision | reverse it, record what would have caught it |
| **Right, never recorded** | the record | make it durable + citable, with `revisit-if` |
| **Right, recorded, unreachable** | reachability | move it onto a surface the next run reads |

In all three the system failed — only in the first was the decision wrong. A
resolution naming none of them is an unresolved recurrence.

**Look up the earlier disposition before re-deriving anything, and name the store
you checked** — addresses, the mechanism-is-the-defect classification, the
hardening floor and the failure modes are in
[`recurring-criticism-mechanics`](../../docs/guidelines/agent-infra/recurring-criticism-mechanics.md).
One line does not migrate, because acting on it wrong is silent: rejections live in
analysis prose by design, so "I found nothing" means *prose was grepped*, never
*nothing was decided*.

## When NOT to fire

- **A repeated task instruction**, not a criticism — that is an instruction, do it.
- **Mechanism-match fails** — a resemblance is not a recurrence.
- **The agent is the one repeating** — that is [`no-cheap-questions`](no-cheap-questions.md).
- **Already resolved this task.** Once decided, it is decided.

## Honest enforcement — `instruction-only`

One narrow deterministic signal exists. `src/scripts/_lib/self_repair.ts` keeps one
record per defect fingerprint with an `occurrences` counter and reopens a released
record when the user re-reports it — literally this rule's trigger state — and the
injected queue line now carries that number, so above 1 an agent sees it. Three
limits: `agents/runtime/` is gitignored, so the store is one machine's and empty on
a fresh checkout; it covers only defects the complaint detector matched, where a
phrasing outside the added patterns is a paraphrase away from silence; and it is
hook-carried, so on a host without the slot nothing fires.

The rest is model-carried, named rather than implied: **nothing** observes whether
the earlier disposition was opened, for rejections there is nothing structured to
open, and no gate can tell a resolution that named one of the three outcomes from
one that asserted it. Claiming the counter as coverage for any of that would
inflate it, so it is not claimed — skipping this rule is caught by nothing.

## See also

- [`decision-revisit-gate`](decision-revisit-gate.md) — the other entrance; owns the five steps and the owner-reserved routing this rule reuses instead of restating. Separate file only because that one sits four lines under the 200-line cap.
- [`self-repair-loop`](self-repair-loop.md) — the single-occurrence intake; this rule is what its `occurrences` counter is for.
- [`active-remediation`](active-remediation.md) — the terminal "leave it" this rule does not override (see `collision_ok`).
- [`/analyze:inbox`](../commands/analyze/inbox.md) § Phase 4c — the artifact-side detection that routes here.
