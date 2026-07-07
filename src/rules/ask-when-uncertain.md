---
type: "always"
tier: "3"
description: "Ask when uncertain — don't guess, assume, or improvise"
alwaysApply: true
workspaces:
  - agent-config-maintainer
  - construction
  - engineering
  - finance
  - founder
  - gtm
  - legal-review-prep
  - ops
  - product
  - small-business
packs:
  - meta
---

# Ask When Uncertain

**When in doubt, ask.** Don't guess or improvise. One question too many beats one wrong assumption.

## Iron Law — one question per turn, ALWAYS

```
ONE QUESTION PER TURN. NO EXCEPTIONS.
ASK. WAIT FOR THE ANSWER. THEN ASK THE NEXT.
```

Even if trivial or independent — exactly one.

## When to ask

- Requirement ambiguous / multi-interpretable.
- Not 100 % sure which approach is correct.
- Touching code you haven't fully understood.
- Multiple valid approaches.
- A fix "seems to work" but you can't explain why.

## Vague-request triggers — MUST ask

Nine patterns — "improve / optimize" · "add caching" · "make it better / cleaner" · "clean up this file" · "fix this" (no symptom) · "refactor X" · "use best practices" · "handle errors properly" · "add a UI / component / tile / page" in a mixed-framework repo. Match without context → ask **before** touching code. Per-pattern questions: [`asking-and-brevity-examples`](../../docs/guidelines/agent-infra/asking-and-brevity-examples.md).

**Escape hatch:** unambiguous from ticket / open file / prior turn → proceed, state the assumption.

## How to ask

Numbered options (per [`user-interaction`](user-interaction.md)). Short.

### Self-check before asking

1. More than one `?` directed at the user this turn?
2. Two or more separate numbered-option blocks?
3. User would need a structured reply (`1a, 2b`) instead of a single number?

Any "yes" → **collapse to ONE question**; hold the rest for their own turn.

### Ordering & handoff

- **Session handoff** — ask LAST, after domain questions ([`agent-interaction-and-decision-quality`](../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md)).
- **Model switch** — [`model-recommendation`](model-recommendation.md) STOP-AND-WAIT gate is standalone.
- **Blocking clarification** — ask FIRST, alone.
- **Optional refinement** — don't ask; state the assumption, proceed.

## Impact-based routing (AI Council)

Council enabled → questions route per `decision_resolution`. **Iron Law: `high_impact` and `user_required` ALWAYS reach the user** ([`ai-council-config`](../../docs/contracts/ai-council-config.md)).

## Creating new agent artifacts

Skill / rule / command / guideline → [`artifact-drafting-protocol`](artifact-drafting-protocol.md) (Understand → Research → Draft).

## Examples

Pattern Memory (wrong / right / why): [`ask-when-uncertain-demos`](../../docs/guidelines/agent-infra/ask-when-uncertain-demos.md). Outcome baseline: [`tests/golden/outcomes/ask_when_uncertain.json`](../../tests/golden/outcomes/ask_when_uncertain.json).
