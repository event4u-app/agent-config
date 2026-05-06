---
type: "always"
tier: "3"
description: "Ask when uncertain — don't guess, assume, or improvise"
alwaysApply: true
source: package
---

# Ask When Uncertain

**When in doubt, ask.** Don't guess, assume, or improvise. One question too many beats one wrong assumption.

## Iron Law — one question per turn, ALWAYS

```
ONE QUESTION PER TURN. NO EXCEPTIONS.
ASK. WAIT FOR THE ANSWER. THEN ASK THE NEXT.
```

Absolute. Every turn with a question has **exactly one** — even if trivial, independent, or batchable.

## When to ask

- Requirement ambiguous or multi-interpretable.
- Not 100 % sure which approach is correct.
- About to touch code you haven't fully understood.
- Choosing between multiple valid approaches.
- A fix "seems to work" but you can't explain why.

## Vague-request triggers — MUST ask

Match without further context → ask **before** touching code:

- "improve / optimize this" — metric? speed, readability, memory?
- "add caching" — store? scope? invalidation?
- "make it better / cleaner" — by what standard?
- "clean up this file" — dead code? format? refactor?
- "fix this" (no symptom) — what output is wrong?
- "refactor X" — target pattern? boundaries?
- "use best practices" — whose? for what?
- "handle errors properly" — which errors? log/retry/propagate?
- "add a UI/component/tile/page" in mixed-framework repo — which stack?

Examples: [`asking-and-brevity-examples § vague-triggers`](../docs/guidelines/agent-infra/asking-and-brevity-examples.md#vague-request-triggers--example-questions).

**Escape hatch:** unambiguous from ticket / open file / prior turn → proceed, state the assumption.

## How to ask

Numbered options (per [`user-interaction`](user-interaction.md)). Short.

### Self-check before asking

1. More than one `?` directed at the user this turn?
2. Two or more separate numbered-option blocks?
3. User would need a structured reply (`1a, 2b`) instead of a single number?

Any "yes" → **collapse to ONE question**. Hold the rest for their own turn. Rationale: [`asking-and-brevity-examples § serial-wins`](../docs/guidelines/agent-infra/asking-and-brevity-examples.md#one-question-per-turn--why-serial-always-wins).

### Ordering & handoff

- **Session handoff** (`/agent-handoff`, fresh-chat) — ask LAST, after domain / clarifying questions, so answers fold into the handoff. Full: [`agent-interaction-and-decision-quality § handoff`](../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#handoff--model-switch-questions).
- **Model switch** — [`model-recommendation`](model-recommendation.md) STOP-AND-WAIT gate is standalone, not appended.
- **Blocking clarification** — ask FIRST, alone, before any research or planning output.
- **Optional refinement** — don't ask; state the assumption, proceed.

## Creating new agent artifacts

Skill / rule / command / guideline creation or major rewrite → [`artifact-drafting-protocol`](artifact-drafting-protocol.md) (Understand → Research → Draft). Don't improvise questions.

## Examples

Pattern Memory (wrong / right / why): [`ask-when-uncertain-demos`](../docs/guidelines/agent-infra/ask-when-uncertain-demos.md). Outcome baseline: [`tests/golden/outcomes/ask_when_uncertain.json`](../../tests/golden/outcomes/ask_when_uncertain.json).
