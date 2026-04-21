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

**Escape hatch:** If the surrounding context (ticket, open file, prior conversation) makes
the answer unambiguous, proceed without asking — but state the assumption explicitly
("Assuming you mean X because Y…").

## How to ask

- Be specific about what is unclear
- Present numbered options (per `user-interaction` rule)
- Keep it short — don't write an essay

## Question batching

- **Simple decisions** (binary, small choices): ask multiple at once, numbered
- **Complex questions** (need context/thinking): ask ONE at a time, wait for answer
- **Handoff questions** (model switch, deeper analysis): ask LAST, after all domain questions

## Special case: creating new agent artifacts

When the user asks to create or significantly rewrite a skill, rule, command, or
guideline, this rule's "ask when in doubt" policy is structured by
[`artifact-drafting-protocol`](artifact-drafting-protocol.md) — a mandatory
Understand → Research → Draft sequence with numbered-options prompts at each step.
Don't improvise clarifying questions in that case; follow the protocol.
