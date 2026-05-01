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

This is absolute. Not a default, not a guideline, not "usually".
Every turn that contains a question contains **exactly one** question.
Even if the questions look trivial. Even if they look independent.
Even if they would fit on one screen. Even if batching "feels more
efficient". Full self-check, ordering, and handoff rules under
[How to ask](#how-to-ask).

## When to ask

- Requirement is ambiguous or could be interpreted multiple ways
- Not 100% sure which approach is correct
- About to touch code you haven't fully understood
- Choosing between multiple valid approaches
- A fix "seems to work" but you can't explain why

## Vague-request triggers — MUST ask

The following patterns are almost always too vague to execute safely. When the user's
request matches one of these without further context, ask **before** touching code:

| Pattern | Missing info | Example question |
|---|---|---|
| "improve / optimize this" | What metric? Speed, readability, memory? | "Optimize for what — execution speed or readability?" |
| "add caching" | Cache store? Scope? Invalidation rules? | "Which cache driver, and what invalidates it?" |
| "make it better / cleaner" | By what standard? | "What specifically feels wrong in the current code?" |
| "clean up this file" | Dead code? Formatting? Refactor? | "Remove unused code, reformat, or restructure?" |
| "fix this" (without specifying) | What's the symptom? | "What output/behavior is wrong right now?" |
| "refactor X" | Target pattern? Boundaries? | "Refactor toward what — smaller methods, extract class, or something else?" |
| "use best practices" | Whose? For what? | "Best practices for what specifically — testing, naming, structure?" |
| "handle errors properly" | Which errors? How? Log, retry, propagate? | "For which failure modes, and what should happen on error?" |
| "add a UI / component / tile / page" when the repo mixes frameworks | Which stack? Tailwind? Flux? Livewire? Custom? | "This repo uses {A} and {B} for UI — which one for this?" |

**Escape hatch:** If surrounding context (ticket, open file, prior conversation)
makes the answer unambiguous, proceed — but state the assumption explicitly.

## How to ask

Be specific. Present numbered options (per `user-interaction`). Keep it short.

The Iron Law (one question per turn) is at the top of this file.
This section adds the rationale, self-check, and ordering.

The user must never have to track sub-numbers, scroll through stacked
option blocks, or split their reply across multiple questions. One
question, numbered options (per `user-interaction`), one short
answer, next turn.

Rationale — why even "trivial" batches fail:

| Situation | Why serial always wins |
|---|---|
| Design / architecture decisions | Answer to Q1 reframes Q2 |
| Naming / command-syntax / API shape | Later choices depend on it |
| Scope / PR boundaries | Changes what the other questions even mean |
| Tool / library selection | Downstream choices branch from it |
| "Which approach: A vs B vs C" | Each answer opens a different follow-up |
| Even "independent" yes/no pairs | User still has to parse two contexts |
| Any question the user has to **think** about, not just pick | Thinking load compounds when stacked |

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
  [`agent-interaction-and-decision-quality`](../guidelines/agent-infra/agent-interaction-and-decision-quality.md#handoff--model-switch-questions).
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
