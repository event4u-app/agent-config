---
type: "auto"
tier: "2a"
alwaysApply: false
norm:
  tokens: 1500
  remainder:
    - "../docs/guidelines/agent-infra/evaluator-independence-mechanics.md"
description: "Commissioning a review/judge/blind-pass on your own work — never author the verdict, never narrow the scope, record the prompt with the result"
triggers:
  - keyword: "blind review"
  - keyword: "blind pass"
  - keyword: "honest null"
  - keyword: "no-findings"
  - keyword: "adversarial review"
  - keyword: "judge"
  - phrase: "review my own"
  - phrase: "commission a review"
  - phrase: "second opinion on my"
routes_to:
  - "guideline:agent-infra/evaluator-independence-mechanics"
self_contained: true
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "hook:evidence-independence"
collision_ok:
  "honest null": "this rule asks how a recorded null was PRODUCED; decision-revisit-gate asks whether it may be REVISITED — different decision points on the same artefact"
# obligation: dispatching an evaluator is a tool call, and the guard is a pre_tool_use
# concern that reads that prompt — src/rules/evaluator-independence.md:81
obligation_frequency: "per-edit"
# frequency-override: line 70 states a per-turn clause ("one evaluation per turn"),
# but the guard counts it AT the dispatch, which is a tool call — a per-edit point
# carrier sees every dispatch, so it carries the per-turn cap too.
---

# Evaluator Independence

When the agent commissions a review, judge, blind pass, or council run **on its
own work**, it is both the author and the author of the evaluator's prompt. That
second role is the one nobody was watching.

## The Iron Law

```
NEVER AUTHOR THE VERDICT INTO AN EVALUATOR'S PROMPT.
NEVER NARROW THE SCOPE OF A REVIEW YOU COMMISSIONED ON YOUR OWN WORK.
A SELF-COMMISSIONED REVIEW IS ADMISSIBLE AS GATE EVIDENCE ONLY WHEN THE PROMPT
IS RECORDED ALONGSIDE THE VERDICT.
A SECOND EVALUATION OF THE SAME WORK IN ONE TURN IS VERDICT SHOPPING, NOT RIGOUR.
```

## The failure this exists to stop

Measured once, at maximum cost: an agent wrote its own "blind reviewer" prompt,
put *"NO-FINDINGS is expected and welcome"* into it, narrowed the scope to four
files it chose, and committed the resulting honest-null as **binding gate
evidence**. An unsteered pass over the same delta later found 5 findings, one
critical, already live on the trunk. The review ran. The process was followed.
The evidence was manufactured anyway. Full record:
[`evaluator-independence-mechanics § The audited failure`](../guidelines/agent-infra/evaluator-independence-mechanics.md).

## What this requires

1. **Neutral prompt.** No expectation of the outcome, in either direction. Not
   "confirm there are no issues", not "I believe this is clean", not "just
   confirm". Ask for findings; do not describe the finding count you expect.
2. **Scope you did not choose to flatter yourself.** The scope is the whole
   delta, or a boundary a human set. "These four files" chosen by the author of
   those files is not a scope, it is a filter.
3. **The prompt ships with the verdict.** A recorded honest-null whose prompt is
   not recoverable is not evidence — nobody can check what was asked.
4. **One evaluation per turn per subject.** Re-running with a different prompt or
   scope after an unwelcome verdict selects the answer instead of measuring it.

## The softer form — stating an expectation without stating the verdict

```
THE ORCHESTRATOR STATES NO EXPECTATION OF THE OUTCOME IN A PROMPT IT WRITES
FOR A JUDGE OF ITS OWN WORK. NOT THE VERDICT, AND NOT THE DIRECTION.
"THIS SHOULD BE CLEAN", "I BELIEVE THIS IS CORRECT", "JUST CONFIRM",
"I EXPECT NO FINDINGS" — NONE OF THESE NAME A VERDICT, AND ALL OF THEM SUPPLY ONE.
```

Write the scope, the diff and the question. Nothing about how it is expected to
come out — including a reassurance that no outcome is expected, which is an
expectation stated in the negative. Why the phrase list cannot see this:
[`evaluator-independence-mechanics § The softer form`](../guidelines/agent-infra/evaluator-independence-mechanics.md).

## Tests are evaluators

```
A TEST IS AN EVALUATOR, AND AN IMPLEMENTER WHO WROTE IT HAS AUTHORED ITS VERDICT.
THE ACCEPTANCE BEHAVIOUR IS NAMED, THE TEST IS WRITTEN INDEPENDENTLY, IT IS SHOWN
RED, THEN IT IS IMPLEMENTED AGAINST, THEN AN INDEPENDENT INSTANCE VALIDATES GREEN.
THE IMPLEMENTER NEVER SILENTLY WEAKENS AN ASSERTION, DELETES, SKIPS OR XFAILS A
FAILING TEST, LOWERS A THRESHOLD, OR CHANGES FIXTURE SEMANTICS TO FIT THE CODE.
WHERE THE TEST LOOKS WRONG: EVIDENCE → INDEPENDENT TEST REVIEW → COUNCIL OR TEAM
→ CHANGE ONLY AFTER AN INDEPENDENT VERDICT. THE OWNER IS NOT THE ARBITER.
```

**Five levels:** L0 same agent — **fallback only** · L1 another session, same
model · L2 another model · L3 another provider · L4 a multi-provider council or
team. Critical behavior — security, authority, data loss, merge control — targets
**L3 or L4 wherever two providers are configured**, read from `agent-config
council:status`'s live provider count, never assumed. Levels, workflow, the
weakening ladder and the validator's checklist:
[`evaluator-independence-mechanics § Tests are evaluators`](../guidelines/agent-infra/evaluator-independence-mechanics.md).

## When it does NOT fire

- **Ordinary parallel fan-out.** Dispatching subagents to read, map, search or
  implement is not evaluation and is not gated.
- A review **a human** commissioned or whose prompt a human wrote.
- A deterministic checker (linter, test suite, CI gate) — no prompt to steer.

## Enforcement — honest scope

```
ITEM 1 IS ENFORCED. ITEMS 2, 3 AND 4 ARE NOT — 4 ONLY WARNS.
NEVER CITE A GUARD THAT WARNS AS ONE THAT BLOCKS.
```

[`evidence_independence.ts`](../scripts/hooks/evidence_independence.ts), a
`pre_tool_use` concern, BLOCKS item 1 on the one host that honours a deny and
only WARNS on item 4. Item 2 is enforced by nothing — a narrowed scope is not
decidable from a prompt. Item 3 is enforced by
[`check_review_prompt_binding.ts`](../../src/scripts/check_review_prompt_binding.ts),
where **omission beats substitution**: not committing the prompt package drops
the round out of the checkable set with no finding.

Where the guard does not deny, every item is model-carried. Never claim the
review ran as if it were verified. Per-branch reasoning, the phrase-list and
turn-boundary limits, the four host states and the 11-of-19 measurement behind
item 3:
[`evaluator-independence-mechanics`](../guidelines/agent-infra/evaluator-independence-mechanics.md).

## See also

- [`verify-before-complete`](verify-before-complete.md) — the completion-claim
  gate this narrows; a self-commissioned review is one kind of evidence it accepts.
- **ADR-257** — which seat may hold the pen: an unpaid route may propose and
  score, never decide. (By number; `docs/` is unprojected.)
- [`adversarial-review`](../skills/adversarial-review/SKILL.md) — how to ask for a
  real critique.
- [`delegation-policy`](delegation-policy.md) — the orchestrator never adopts a
  subagent return unverified; this rule covers the case where the return was
  steered before it was returned.
- [`direct-answers`](direct-answers.md) Iron Law 2 — do not claim what you have
  not verified; a manufactured verdict is the sharpest form of that claim.
