---
type: "auto"
description: "Before implementing features or architectural changes — validate the request against existing code, challenge weak requirements, and suggest improvements"
alwaysApply: false
source: package
---

# Improve Before Implement

## When to activate

Before implementing:

- New features
- Refactoring or architectural changes
- Module or service creation
- Significant code changes that alter behavior

**Does NOT activate for:**

- Bug fixes (the problem is already defined)
- Config changes, documentation, quality fixes
- Tasks where the user said "just do it" or "skip validation"
- Trivial changes (rename, typo, formatting)

## What to check

Before coding, quickly verify:

### 1. Is the request clear?

- Are acceptance criteria defined or derivable?
- Is the scope bounded? (not "make it better" but "add X to Y")
- Are edge cases considered?

**If unclear** → ask ONE focused question. Max 2 questions, never an interrogation.

### 2. Does it fit the existing architecture?

- Does similar functionality already exist?
- Does it follow established patterns in the codebase?
- Does it contradict existing conventions?
- Do **multiple valid patterns/frameworks** already exist (e.g. Tailwind + Flux, multiple form libraries, competing state stores)? If yes, do NOT pick one arbitrarily — ask which to use.
- Is the change a **second branch on the same discriminator** — second `match`/`switch` arm, second `if/elseif`, or second class hardcoded to one enum value (e.g. `Provider::FOO`, `'stripe'`)? If yes, run the Strategy sniff test before adding the branch — see [`docs/guidelines/php/patterns/strategy.md`](../../docs/guidelines/php/patterns/strategy.md#sniff-test--when-an-enumstring-discriminator-wants-to-become-a-strategy).

**If misfit** → show evidence (file references), propose alternative.
**If multiple valid options** → list them, ask which to use. See [`no blind implementation`](../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#2-no-blind-implementation).

### 3. Is the approach sound?

- Is there a simpler way to achieve the same result?
- Are there known problems with the requested approach?
- Does the scope match the stated goal? (not over-engineered, not under-specified)

**If problematic** → explain the concern, propose a better approach.

## How to challenge

- **Be concise** — one sentence per concern, not paragraphs
- **Show evidence** — reference existing code, patterns, or conventions
- **Offer alternatives** — don't just say "this is wrong"
- **Use numbered options** — let the user choose quickly
- **Respect "just do it"** — if the user insists after your challenge, execute immediately

Example:

```
> ⚠️ `UserService` already has a `deactivate()` method that covers this case.
>
> 1. Use existing method — extend with new parameter
> 2. Create new method anyway — I'll explain the overlap in a comment
> 3. Skip validation — implement as requested
```

## The golden rule

**Challenge to improve, never to refuse.**

The agent is a thought partner, not a gatekeeper. After presenting concerns:
- User picks an option → execute immediately
- User says "just do it" → execute immediately
- Never argue twice about the same point
- Never block work — delay is only justified if it prevents a clear mistake

## Scope limits

- **Max 1-2 challenges per task** — not every request needs validation
- **Max 1 minute of analysis** — if the check takes longer, skip it
- **Never validate simple tasks** — only features, architecture, significant changes
- **Never validate after the user already explained their reasoning**

## Creating new agent artifacts

When the request is to create or significantly rewrite a skill, rule, command,
or guideline, the "fit the existing architecture" check above is handled by
[`artifact-drafting-protocol`](artifact-drafting-protocol.md)'s Phase B
(Research). Follow that protocol instead of improvising a one-shot check — it
scans `.agent-src.uncompressed/` for overlap and reports candidates to extend
before creating a new file.
