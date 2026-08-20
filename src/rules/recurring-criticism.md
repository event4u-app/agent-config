---
type: "auto"
tier: "2b"
description: "The same criticism arriving again indicts the system, not only the item — reopen the disposition that dismissed it, resolve on evidence, never on the repetition count"
alwaysApply: false
# Triggers are phrases, not keywords: a bare "again" / "wieder" fires on a large
# share of ordinary prompts, and an over-broad trigger is worse than the gap it
# closes. The recurrence marker has to sit next to a saying-verb or a count.
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
  - "skill:skill-improvement-pipeline"
  - "skill:decision-review"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
collision_ok:
  "schon wieder": "active-remediation makes a user 'leave it' terminal against the AGENT re-raising a closed item; this rule fires only when the USER brings it back — a decision-maker reopening their own decision is not the nagging that rule prevents"
obligation_frequency: "per-task"
---

# Recurring Criticism

[`decision-revisit-gate`](decision-revisit-gate.md) has one entrance: the agent
wants to do something and a lock is in the way. This is the other one, and until
now nothing owned it — **the same criticism arrives again.** Same subject, second
or third time, from the user or from a re-arrived artifact.

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

## The repetition reverses the burden of proof

The standing rule is: same mechanism, no new evidence → the lock applies and
nothing is surfaced. Recurrence **is** the new evidence — not that the item is
right, that the disposition did not hold. Whoever wants to keep the lock now
carries the argument.

**Mechanism-match still runs first**, borrowed unchanged from the sibling rule: a
new complaint that resembles the old one but tests a different mechanism is not a
recurrence, and saying so is the answer.

## Resolve on evidence, never on the count

This is the load-bearing clause and the one a later editor is most likely to trim
as hedging. Challenging a model's answer — **including a correct one** — reliably
makes it capitulate and revise toward the perceived expectation rather than toward
truth <!-- harvest:reflection-sycophancy-flipflop -->. A rule that treated "said
twice" as proof of error would be that failure mode with a procedure attached. The
repetition opens the question; it never answers it.

## Exactly three outcomes

The repetition proves the **system** failed <!-- harvest:recurrence-indicts-the-system -->.
It does not by itself prove the **decision** was wrong. Own analysis, derived from
that split:

| Outcome | What actually broke | What hardening means |
|---|---|---|
| The disposition was **wrong** | the decision | reverse it, and record what would have caught it sooner |
| **Right, but never recorded** | the record | make it durable and citable, with scope + `revisit-if` |
| **Right and recorded, but unreachable** | reachability | move it onto a surface the next run actually reads |

In all three the system failed — only in the first was the decision wrong. A
resolution naming none of the three is an unresolved recurrence.

## Look it up before re-deriving it

Without a forced lookup of the earlier disposition, every recurrence becomes a
fresh investigation even where the answer already exists
<!-- harvest:forced-lookup-of-past-root-causes -->. Name which store you checked:
`docs/decisions/` + `INDEX.md` (via `adr_cite_check`), `agents/decisions/*.yml`,
`agents/roadmaps/{archive,skipped,later}/`, the curated memory YAML under
`agents/memory/`, `agents/evidence/analysis/`.

**Rejections are the weak spot, by design.** `provenance/README.md` records that a
`reject` verdict lives in the analysis document rather than a ledger — so "I found
nothing" here means *unstructured prose was grepped*, not *nothing was decided*.
Say which of the two you mean.

## The mechanism is the candidate defect, not the item

Classify what was missing before choosing an artefact
([`skill-improvement-pipeline`](../skills/skill-improvement-pipeline/SKILL.md)
§ Classify the missing component), and land the learning where it constrains the
next run ([`learning-to-rule-or-skill`](../skills/learning-to-rule-or-skill/SKILL.md)).
A lesson that does not narrow the next attempt produces thrashing rather than
convergence <!-- harvest:unconstraining-lesson-thrashes -->; a learning that lives
only in a reply is not one. **Third recurrence of the same class escalates to
structure** ([`decision-review`](../skills/decision-review/SKILL.md) § Escalation)
— a louder restatement of a rule the agent keeps missing is the one response
already known not to work.

## No hardening buys itself with a safety floor

Self-improvement loops can regress the thing they improve
<!-- harvest:self-improvement-can-self-regress -->, so a hardening change carries
the same evidence bar as any other change, and never arrives as a weakened gate, a
widened allowlist, a lifted Hard Floor, or a loosened ratchet. "We learned
something" is not a licence.

## When NOT to fire

- **A repeated task instruction**, not a criticism. That is an instruction; do it.
- **Mechanism-match fails** — a resemblance is not a recurrence.
- **The agent is the one repeating** — asking again what was already answered is
  [`no-cheap-questions`](no-cheap-questions.md), not this.
- **Already resolved this task.** Once decided, it is decided.

## Honest enforcement — `enforced_by: none`

One deterministic signal exists and it is narrow. `src/scripts/_lib/self_repair.ts`
keeps one record per defect fingerprint with an `occurrences` counter and reopens a
released record when the user re-reports it — literally this rule's trigger state —
and the injected queue line now carries that number, so above 1 an agent sees it.
Three limits: `agents/runtime/` is gitignored, so the store is one machine's and
empty on a fresh checkout; it only covers defects the complaint detector matched,
where a recurrence phrasing outside the added patterns is a paraphrase away from
silence; and it is hook-carried, so on a host without the slot nothing fires.

The rest is model-carried, and the gaps are named rather than implied: **nothing**
observes whether the earlier disposition was opened, for rejections there is
nothing structured to open, and no gate can tell a resolution that named one of the
three outcomes from one that asserted it. Claiming the fingerprint counter as
coverage for any of that would inflate it, so it is not claimed — skipping this
rule is caught by nothing.

## See also

- [`decision-revisit-gate`](decision-revisit-gate.md) — the lock-blocking entrance, the five steps, and the owner-reserved routing this rule reuses instead of restating.
- [`self-repair-loop`](self-repair-loop.md) — the single-occurrence intake; this rule is what its `occurrences` counter is for.
- [`active-remediation`](active-remediation.md) — the terminal "leave it" this rule deliberately does not override (see `collision_ok`).
- [`/analyze:inbox`](../domains/analysis-workbench/analyze/inbox/command.md) § Phase 4c — the artifact-side detection that routes here.
