---
type: "always"
source: package
---

# Commands

When user types command (`/create-pr`, `# create-pr`, or pastes command file),
**execute immediately**. No questions, opinions, summaries, confirmations.

- Match command file in `.augment/commands/` (or `agents/overrides/commands/`)
- Read it, follow steps in order
- Ask only when command says "ask the user"
- Pasted command content = invocation, NOT question
- **NEVER** "looks good" or "shall I execute?" — execute
- **NEVER** "this is the current version" — execute
- **NEVER** treat pasted content as review request — ALWAYS invocation
- Exception: user explicitly says "update this command" or "review this command"
