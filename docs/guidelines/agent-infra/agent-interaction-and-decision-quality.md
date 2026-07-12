# agent-interaction-and-decision-quality

Improves how the agent asks questions, handles uncertainty, learns from feedback,
and integrates quality rules into CI.

## Core principles

- Do not guess when clarification is cheap
- Do not overwhelm the user with too many complex questions at once
- Prefer structured decision-making over assumptions
- Learn from negative feedback and turn it into system improvements
- Integrate recurring improvements into rules, skills, or CI

## 1. Question strategy

### Simple decisions

If questions are simple binary or small choices — ask multiple at once, numbered clearly:

```
1. Use Tailwind or existing styles?
2. Add tests? (yes/no)
3. Extend existing component or create new one?
```

### Complex questions

If questions require thinking, context-create, or explanation:

- Ask ONE question at a time
- Wait for answer before continuing
- Do not bundle multiple complex topics together

### Handoff / model-switch questions

If a handoff (e.g. model change, deeper analysis) is required:

1. First ask all necessary domain questions (step-by-step if complex)
2. Then ask the handoff question LAST

Reason: answers must be available before switching context — avoids incomplete downstream instructions.

## 2. No blind implementation

Before implementing, analyze what already exists:

- Identify used frameworks, libraries, patterns
- If multiple UI systems exist (e.g. Tailwind, shadcn, custom): ask which one to use
- Do NOT pick one arbitrarily or start implementation without alignment

## 3. Handling unclear requirements

If instructions are incomplete:

- Do NOT assume missing behavior
- Do NOT silently decide critical aspects
- Ask precise clarification questions or output a structured clarification request

## 4. Learning from negative feedback

If the user complains, says something is wrong, or shows frustration:

1. Do NOT ignore or defend blindly
2. Extract the underlying failure pattern
3. Convert it into one of:
   - Rule (constraint to prevent recurrence)
   - Skill improvement (better workflow step)
   - Guideline addition (reference convention)
   - Linter check (if recurring and automatable)

> Every mistake should improve the system.

## 5. CI integration mindset

When introducing new quality patterns, consider whether they should be enforced automatically.

If unsure, ask:
- "Should this be enforced via CI?"
- "Should this be part of the linter?"

Prefer consistent enforcement over manual discipline.

## 6. Decision transparency

When making decisions:

- State what you assumed
- State what alternatives exist
- State why a decision was made
- If the decision is important: confirm with the user before proceeding

## 7. Efficiency in interaction

- Avoid long back-and-forth caused by poor initial questions
- Avoid rework caused by wrong assumptions
- Prefer: short clarification early → correct implementation once

## 8. Improve before implement — pre-implementation validation

_Origin: migrated from `src/rules/improve-before-implement.md` per the P4 pattern of `road-to-kernel-and-router.md`. The rule keeps the activation lists and the golden rule ("Challenge to improve, never to refuse"); the check detail lives here._

Before coding a new feature, refactor, module, or behavior-altering change, quickly verify:

### 8a. Is the request clear?

- Are acceptance criteria defined or derivable?
- Is the scope bounded? (not "make it better" but "add X to Y")
- Are edge cases considered?

**If unclear** → ask ONE focused question. Max 2 questions, never an interrogation.

### 8b. Does it fit the existing architecture?

- Does similar functionality already exist?
- Does it follow established patterns in the codebase?
- Does it contradict existing conventions?
- Do **multiple valid patterns/frameworks** already exist (e.g. Tailwind + Flux, multiple form libraries, competing state stores)? If yes, do NOT pick one arbitrarily — ask which to use.
- Is the change a **second branch on the same discriminator** — second `match`/`switch` arm, second `if/elseif`, or second class hardcoded to one enum value (e.g. `Provider::FOO`, `'stripe'`)? If yes, run the Strategy sniff test before adding the branch — see [`strategy.md`](../php/patterns/strategy.md#sniff-test--when-an-enumstring-discriminator-wants-to-become-a-strategy).

**If misfit** → show evidence (file references), propose alternative.
**If multiple valid options** → list them, ask which to use. See [§ 2 — No blind implementation](#2-no-blind-implementation).

### 8c. Is the approach sound?

- Is there a simpler way to achieve the same result?
- Are there known problems with the requested approach?
- Does the scope match the stated goal? (not over-engineered, not under-specified)

**If problematic** → explain the concern, propose a better approach.

### How to challenge

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

After presenting concerns: user picks an option → execute immediately; user says "just do it" → execute immediately. Never argue twice about the same point. Never block work — delay is only justified if it prevents a clear mistake.

### Scope limits

- **Max 1-2 challenges per task** — not every request needs validation
- **Max 1 minute of analysis** — if the check takes longer, skip it
- **Never validate simple tasks** — only features, architecture, significant changes
- **Never validate after the user already explained their reasoning**

### Verify with concrete tools, not prose

If the challenge requires you to confirm current behavior before proposing an alternative, use a concrete probe — a `curl` against the endpoint, a Playwright spec, a debugger / `xdebug` step-through, or the project's test runner with a targeted filter. Asserting current behavior from memory is not validation.

### Intent inference (RDP, standard host)

When the literal request and the underlying goal may differ, **state the inferred goal in one line and give ONE recommendation** — do not spread 2–3 framings (that is the overplanning [`direct-answers`](../../../src/rules/direct-answers.md) suppresses). Standard host only; a strong-reasoning host self-infers, so skip it there. Engage per [`rdp-gate`](../../../src/agent-src/contexts/execution/rdp-gate.md).

## Anti-patterns

- Asking 5 complex questions at once
- Mixing clarification and implementation in the same step
- Doing handoff before collecting required context
- Blindly choosing frameworks/tools without checking existing usage
- Ignoring user frustration instead of learning from it
- Introducing new quality rules without considering CI enforcement
- Making important decisions silently without stating reasoning

## Final principle

> Ask better → decide better → build once → improve system continuously
