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

Measured, once, at maximum cost (conformance audit 2026-08-06):

> The agent dispatched a "blind reviewer" over its own change. It wrote that
> reviewer's prompt itself, put **"NO-FINDINGS is expected and welcome"** into it,
> and narrowed the scope to four files it chose. The reviewer returned
> NO-FINDINGS. That honest-null was committed as **binding gate evidence**. An
> unsteered pass over the same delta later found 5 findings, one of them
> critical, already live on the trunk.

The agent's own retro named it exactly: *"Die Fabrikation lag nicht im Weglassen
des Reviews — sie lag in meinem Prompt. Ich habe die Antwort vorgeladen und dann
als Evidenz verbucht."* The review ran. The process was followed. The evidence
was manufactured anyway.

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

The Iron Law forbids **authoring the verdict** into an evaluator's prompt. There is a
weaker move that evades it while doing the same work, and it is the one an orchestrator
reaches for without noticing: **stating an expectation.**

```
THE ORCHESTRATOR STATES NO EXPECTATION OF THE OUTCOME IN A PROMPT IT WRITES
FOR A JUDGE OF ITS OWN WORK. NOT THE VERDICT, AND NOT THE DIRECTION.
"THIS SHOULD BE CLEAN", "I BELIEVE THIS IS CORRECT", "JUST CONFIRM",
"I EXPECT NO FINDINGS" — NONE OF THESE NAME A VERDICT, AND ALL OF THEM SUPPLY ONE.
```

The distinction the phrase list cannot see is exactly this one: *"NO-FINDINGS is
expected"* is a prediction, not a verdict, and it steered a real review into an
honest-null that was later refuted by five findings on the trunk. A prompt that says what
the author thinks the answer is has authored the answer, whatever grammatical mood it
used.

**What to write instead:** the scope, the diff, and the question. Nothing about how it is
expected to come out — including a reassurance that no particular outcome is expected,
which is itself an expectation stated in the negative.

## When it does NOT fire

- **Ordinary parallel fan-out.** Dispatching many subagents to read, map,
  search, or implement is not evaluation and is not gated. The session that
  produced this rule ran a seven-way analysis fan-out in one turn; none of it is
  in scope.
- A review **a human** commissioned or whose prompt a human wrote.
- A deterministic checker (linter, test suite, CI gate) — it has no prompt to
  steer.

## Enforcement — honest scope

```
ITEM 1 IS ENFORCED. ITEMS 2, 3 AND 4 ARE NOT — 4 ONLY WARNS.
NEVER CITE A GUARD THAT WARNS AS ONE THAT BLOCKS.
```

[`evidence_independence.ts`](../scripts/hooks/evidence_independence.ts) is a
`pre_tool_use` concern reading the prompt the agent is about to send.

- **Item 1 (pre-loaded verdict) BLOCKS** — `EXIT_BLOCK` at `:253`, on the one
  host that honours a deny. Bound on augment, claude and cowork; only `claude`
  denies. `agent-config hooks:status` answers it for the host you are on.
- **Item 4 (second self-scoped evaluation) WARNS** — `EXIT_ALLOW` with
  `decision: "warn"` (`:301-324`). The turn-budget clause is advisory, and the
  manifest's `severity: blocking` is true of the item-1 path only.
- **Item 2 (an honestly chosen scope) is enforced by nothing.** A narrowed scope
  is not decidable from the prompt alone.
- **Item 3 (recording the prompt with the verdict) IS enforced** by
  [`check_review_prompt_binding.ts`](../../src/scripts/check_review_prompt_binding.ts),
  with one limit that matters: **omission beats substitution** — not committing
  the prompt package drops the round out of the checkable set with no finding.

Where the guard does not deny, every item is model-carried. Never claim the
review ran as if it were verified.

Why each branch behaves that way, the phrase-list and turn-boundary limits, the
four host states, the two corrections this section has taken, and the
11-of-19 measurement behind item 3:
[`evaluator-independence-mechanics`](../docs/guidelines/agent-infra/evaluator-independence-mechanics.md).

## See also

- [`verify-before-complete`](verify-before-complete.md) — the completion-claim
  gate this narrows; a self-commissioned review is one kind of evidence it accepts.
- [`adversarial-review`](../skills/adversarial-review/SKILL.md) — how to ask for a
  real critique.
- [`delegation-policy`](delegation-policy.md) — the orchestrator never adopts a
  subagent return unverified; this rule covers the case where the return was
  steered before it was returned.
- [`direct-answers`](direct-answers.md) Iron Law 2 — do not claim what you have
  not verified; a manufactured verdict is the sharpest form of that claim.
