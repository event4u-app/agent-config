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
