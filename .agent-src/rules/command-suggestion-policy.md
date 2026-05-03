---
type: "auto"
description: "User prompt without /command but matching an eligible slash command — surface matches as numbered options with as-is escape hatch; never auto-executes, user always picks"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/command-suggestion-policy-mechanics.md
---

# Command Suggestion

When the user's prompt matches an eligible slash command, surface it
as a **numbered option** alongside an "as-is" escape hatch — the
"run prompt as-is" option is **always last** and **always present**,
never omitted. The user always picks. **Nothing auto-executes.** The
suggestion layer is a read-only shortcut *finder*, not an invocation
path.

The deterministic engine lives in `scripts/command_suggester/`. The
locked eligibility table lives in
[`agents/contexts/command-suggestion-eligibility.md`](../../agents/contexts/command-suggestion-eligibility.md).
The full design lives in
[`road-to-context-aware-command-suggestion`](../../agents/roadmaps/road-to-context-aware-command-suggestion.md).

## Iron Law — never auto-execute

```
SUGGEST. NEVER INVOKE. THE USER PICKS, ALWAYS.
```

A suggestion block emits options. It does **not** start a command
flow. The user picking option N triggers `slash-command-routing-policy` on the
**next** turn — with all the command's own halts intact.

## When to fire

On a user turn that matches **all** of the following:

1. The message does **not** start with an explicit `/command` (those
   bypass suggestion entirely — see `slash-command-routing-policy`).
2. `commands.suggestion.enabled` is `true` (default).
3. The user has not issued `/command-suggestion-off` in this conversation.
4. No clarification is owed for the same turn (per
   `ask-when-uncertain` — clarification wins; suggestion can fire next turn).
5. No active engine flow is mid-halt (e.g. an `/implement-ticket`
   step waiting on the user — the active flow has the floor).
6. The matcher returns at least one match above the effective
   `confidence_floor` after rank + cooldown + anti-noise.

When all six hold, the suggestion block is the **first and only**
thing the agent emits that turn. No tools, no edits, no other prose.

## Subordination — when to stay silent

The suggestion rule is **junior** to:

- `scope-control` — never surfaces a git-op command behind a
  permission gate the user already declined this turn.
- `ask-when-uncertain` — if a clarification is owed, the
  clarification is the only question; suggestion suppresses for
  that turn.
- `verify-before-complete` — suggestion does not interrupt an
  evidence-gate verification that's already running.
- Any active role-mode contract (`role-mode-adherence`).
- Any active engine halt (`/implement-ticket`, `/work`, etc.).

On any conflict → suggestion stays silent. Zero output. The user's
prompt is processed as it would be without this rule.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) the rule is **inert**
unless the suggester package is shipped in the bundle. Treat
`commands.suggestion.enabled` as `false` when the engine is not
available — degrade silently, never crash the turn.

## Mechanics — output format, anti-noise, what this rule does NOT do

The exact rendered options block, the `Recommendation:` rules, the
`max_options` cap, the `rank.py` anti-noise filters, and the
"what this rule does NOT do" catalog live in
[`contexts/communication/rules-auto/command-suggestion-policy-mechanics.md`](../contexts/communication/rules-auto/command-suggestion-policy-mechanics.md).

## Interactions

- [`slash-command-routing-policy`](slash-command-routing-policy.md) — explicit `/command` skips suggestion entirely.
- [`user-interaction`](user-interaction.md) — numbered-options Iron Law and single-source recommendation.
- [`ask-when-uncertain`](ask-when-uncertain.md) — clarification wins on conflict.
- [`scope-control`](scope-control.md) — git-op gates outrank suggestion.
- [`role-mode-adherence`](role-mode-adherence.md) — active mode contract outranks suggestion.
- [`agents/contexts/command-suggestion-eligibility.md`](../../agents/contexts/command-suggestion-eligibility.md) — locked eligibility table.
