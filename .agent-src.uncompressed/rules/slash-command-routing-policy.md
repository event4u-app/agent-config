---
type: "auto"
tier: "1"
description: "When user types a slash command like /create-pr, /commit, or pastes command file content"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md
---

# Commands

When the user types a command (`/create-pr`, `# create-pr`, or pastes a command file),
**execute it immediately**. No questions, no opinions, no summaries, no confirmations.

- Match the command file in `.augment/commands/` (or `agents/overrides/commands/`).
- Read it, follow the steps in order.
- Ask only when the command itself says "ask the user".
- If the user pastes the **content** of a command file, treat it as an invocation — not a question.
- **NEVER** respond with "looks good" or ask "shall I execute?" — just execute.
- **NEVER** respond with "this is the current version" or "do you want to change something?" — just execute.
- **NEVER** treat pasted command content as a review request — it's ALWAYS an invocation.
- The only exception: the user's message contains an explicit instruction about the command
  (e.g., "update this command" or "review this command"). In that case, follow the instruction instead.

## Open files are irrelevant for command detection

The editor may report that the user has a file open (e.g., "The user has file `compress.md` open").
This is **irrelevant** for command detection.

- If the user types `/compress`, they want to **run** the compress command — even if `compress.md` is open in the editor.
- If command file content appears in the context alongside an open file, the **command invocation takes priority**.
- Do NOT confuse "file is open" with "user wants to discuss this file".
- The user's typed message determines intent — not editor state.

## Read the whole prompt — command is the operator, prose is the target

```
/<command> IS THE OPERATOR.
THE REST OF THE USER MESSAGE NAMES THE TARGET.
NEVER ASSUME THE COMMAND NAME IS THE TARGET.
```

The slash token tells you **what to do**; the surrounding prose tells
you **what to do it on**.

- `/council and analyse chat-history` → target is `chat-history`,
  not `council`. Council is the *tool*, the prose names the *artefact*.
- `/work the memory bug from PROJ-123` → target is "the memory bug
  from PROJ-123".
- `/fix ci and then open a PR` → target is "CI failure"; the trailing
  "open a PR" is a follow-up requiring separate permission (per
  `scope-control`).

### Pre-flight before expensive operations

Before any operation that costs the user real time or money — API call
to an external model, large codebase analysis, multi-file refactor,
council run, generated test suite — run this check silently:

1. Re-read the **whole** user message, not just the slash and its
   first token.
2. Identify the target the prose actually names.
3. If the target is unambiguous → execute, no question.
4. If the target is **genuinely** ambiguous after re-reading (e.g.
   prose names *two* artefacts and you cannot tell which is the
   operand) → ask ONE disambiguating numbered-options question per
   [`ask-when-uncertain`](ask-when-uncertain.md), then proceed.

This is **not** a license to re-introduce cheap questions
(`no-cheap-questions` still binds). The threshold is *"would this guess
waste the user's tokens, money, or trust?"* — not *"I'd feel safer
asking"*. The single failure mode to avoid: spending API spend on the
wrong artefact because the agent fixated on the command name.
