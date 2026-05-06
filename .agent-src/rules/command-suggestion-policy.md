---
type: "auto"
tier: "mechanical-already"
description: "User prompt without /command but matching an eligible slash command — surface matches as numbered options with as-is escape hatch; never auto-executes, user always picks"
source: package
triggers:
  - phrase: "free-form prompt"
  - phrase: "command suggestion"
routes_to:
  - "contract:command-suggestion-flow"
---

# Command Suggestion Policy

When the user's prompt matches an eligible slash command, surface it as a
**numbered option** alongside an "as-is" escape hatch. The user always
picks. **Nothing auto-executes.**

Body migrated to [`contract:command-suggestion-flow`](../../docs/contracts/command-suggestion-flow.md)
(per P4 of `road-to-kernel-and-router.md`). Trigger-set above activates
this routing under the `balanced` and `full` profiles.

## Iron Law — never auto-execute

```
SUGGEST. NEVER INVOKE. THE USER PICKS, ALWAYS.
```

A suggestion block emits options. It does **not** start a command flow.
The "run as-is" option is **always present**, **always last**, never
removed.

## Subordination — when to stay silent

The suggestion rule is **junior** to:

- [`scope-control`](scope-control.md) — never surfaces a git-op command
  behind a permission gate the user already declined.
- [`ask-when-uncertain`](ask-when-uncertain.md) — clarification wins on
  conflict; suggestion suppresses for that turn.
- [`verify-before-complete`](verify-before-complete.md) — suggestion does
  not interrupt an evidence-gate verification.
- [`role-mode-adherence`](role-mode-adherence.md) — active role-mode
  contract outranks suggestion.
- Any active engine halt (`/implement-ticket`, `/work`).

On any conflict → suggestion stays silent.
