---
type: "always"
description: "Ask when uncertain — don't guess, assume, or improvise"
alwaysApply: true
source: package
---

# Ask When Uncertain

**When in doubt, ask the user.** Do not guess, assume, or improvise.
Asking one question too many is always better than a wrong assumption.

## Iron Law — one question per turn, ALWAYS

```
ONE QUESTION PER TURN. NO EXCEPTIONS.
ASK. WAIT FOR THE ANSWER. THEN ASK THE NEXT.
```

Absolute. Not a default, not "usually". Every turn with a question
has **exactly one**. Even if trivial, independent, or batchable.
Self-check, ordering, handoff under [How to ask](#how-to-ask).

## When to ask

- Requirement ambiguous or multi-interpretable
- Not 100% sure which approach is correct
- About to touch code you haven't fully understood
- Choosing between multiple valid approaches
- A fix "seems to work" but you can't explain why

## Vague-request triggers — MUST ask

These patterns are too vague to execute safely. Match without further
context → ask **before** touching code:

- "improve / optimize this" — metric? speed, readability, memory?
- "add caching" — store? scope? invalidation?
- "make it better / cleaner" — by what standard?
- "clean up this file" — dead code? format? refactor?
- "fix this" (no symptom) — what output is wrong?
- "refactor X" — target pattern? boundaries?
- "use best practices" — whose? for what?
- "handle errors properly" — which errors? log/retry/propagate?
- "add a UI/component/tile/page" in mixed-framework repo — which stack?

Example questions per pattern:
[`asking-and-brevity-examples`](../../docs/guidelines/agent-infra/asking-and-brevity-examples.md#vague-request-triggers--example-questions).

**Escape hatch:** if context (ticket, open file, prior turn) makes
the answer unambiguous, proceed — but state the assumption.

## How to ask

Numbered options (per `user-interaction`). Short. The Iron Law is at
the top; this section adds self-check and ordering.

The user must never track sub-numbers, scroll stacked option blocks,
or split a reply across multiple questions. Rationale shorthand: if
the user has to *think* about an answer, that answer almost always
reframes the next question. Full rationale:
[`asking-and-brevity-examples`](../../docs/guidelines/agent-infra/asking-and-brevity-examples.md#one-question-per-turn--why-serial-always-wins).

### Self-check before asking

Before sending a turn with a question, ask yourself:

1. Does this turn contain more than one `?` directed at the user?
2. Does this turn present two or more separate numbered-option blocks?
3. Would the user need to reply with a structured answer (`1a, 2b`)
   instead of a single number or word?

If any answer is "yes" → **collapse to ONE question** and send. Hold
every other question for its own turn. No exceptions, no "but these
are related".

### Ordering & handoff

- **Session handoff** (`/agent-handoff`, fresh-chat proposal): ask LAST,
  after all domain / clarifying questions — so the user's answers can be
  folded into the handoff prompt. Full rationale in
  [`agent-interaction-and-decision-quality`](../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#handoff--model-switch-questions).
- **Model switch**: different phase — [`model-recommendation`](model-recommendation.md)
  triggers at task start with its own STOP-AND-WAIT gate, standalone, not
  appended to a Q&A block. Do not conflate the two.
- **Blocking clarification** (can't proceed without it): ask FIRST,
  alone, before any research or planning output.
- **Optional refinement**: don't ask at all — state the assumption
  and proceed.

## Creating new agent artifacts

For skill/rule/command/guideline creation or major rewrite, follow
[`artifact-drafting-protocol`](artifact-drafting-protocol.md) — structured
Understand → Research → Draft. Don't improvise questions.

## Examples

Pattern Memory — wrong / right / why demos for the Iron Laws above:
[`ask-when-uncertain-demos`](../../docs/guidelines/agent-infra/ask-when-uncertain-demos.md)
(vague-request triggers, multi-question stacks, handoff ordering).
Outcome baseline locked at
[`tests/golden/outcomes/ask_when_uncertain.json`](../../tests/golden/outcomes/ask_when_uncertain.json).
