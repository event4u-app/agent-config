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

## How to ask

- Be specific about what is unclear
- Present numbered options (per `user-interaction` rule)
- Keep it short — don't write an essay

## Question batching

- **Simple decisions** (binary, small choices): ask multiple at once, numbered
- **Complex questions** (need context/thinking): ask ONE at a time, wait for answer
- **Handoff questions** (model switch, deeper analysis): ask LAST, after all domain questions
