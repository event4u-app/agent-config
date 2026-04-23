---
type: "always"
description: "Ask when uncertain — don't guess, assume, or improvise"
alwaysApply: true
source: package
---

# Ask When Uncertain

**When in doubt, ask the user.** Do not guess, assume, or improvise.
Asking one question too many is always better than a wrong assumption.

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

**Escape hatch:** If surrounding context (ticket, open file, prior conversation)
makes the answer unambiguous, proceed — but state the assumption explicitly.

## How to ask

Be specific. Present numbered options (per `user-interaction`). Keep it short.

### The Iron Law — one question at a time, by default

```
DEFAULT: ONE QUESTION PER TURN. WAIT FOR THE ANSWER. THEN ASK THE NEXT.
```

Dumping a list of 3+ design questions on the user is a rule violation,
not a style choice. The user must not have to scroll through a wall of
numbered options to reply. Reply length in the user's last message is
the signal: if they answered with a short number or word, keep future
questions equally short. One question, ask, wait, read, decide, ask
the next — even if it feels slower.

### The only exception — truly trivial, truly independent

Asking **multiple questions in one turn** is allowed **only** when ALL
of the following hold:

- Each question has a **binary or 2–3-option** answer.
- Answers are **fully independent** — answer to Q1 does not change
  Q2's options, Q3's options, etc.
- The whole block fits on **one screen** (max 3 questions, max ~12
  lines of options total).
- None of the questions is a **design decision, architecture choice,
  scope decision, or naming decision**.

If any of these fail, ask ONE question, wait, then ask the next.

### Hard "ask one at a time" triggers

| Situation | Why serial, not batch |
|---|---|
| Design / architecture decisions | Answer to Q1 reframes Q2 |
| Naming / command-syntax / API shape | Later choices depend on it |
| Scope / PR boundaries | Changes what the other questions even mean |
| Tool / library selection | Downstream choices branch from it |
| "Which approach: A vs B vs C" | Each answer opens a different follow-up |
| Any question the user has to **think** about, not just pick | Thinking load compounds when stacked |

### Self-check before asking

Before sending a turn with questions, ask yourself:

1. Is this ONE question, or more?
2. If more — does EVERY question pass all four "only exception"
   conditions above?
3. Would the user have to scroll to see all options?
4. Is the answer to Q1 going to change Q2's options?

If any answer is "yes / no / not sure" → collapse to ONE question
and send. Hold the rest for the next turn.

### Ordering & handoff

- **Model switch / handoff**: ask LAST (per `model-recommendation`).
- **Blocking clarification** (can't proceed without it): ask FIRST,
  alone, before any research or planning output.
- **Optional refinement**: don't ask at all — state the assumption
  and proceed.

## Creating new agent artifacts

For skill/rule/command/guideline creation or major rewrite, follow
[`artifact-drafting-protocol`](artifact-drafting-protocol.md) — structured
Understand → Research → Draft. Don't improvise questions.
