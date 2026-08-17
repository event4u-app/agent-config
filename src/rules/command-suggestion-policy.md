---
type: "auto"
tier: "mechanical-already"
description: "Prompt matches an eligible slash command — surface as numbered options with as-is escape; never auto-execute"
triggers:
  - phrase: "free-form prompt"
  - phrase: "command suggestion"
routes_to:
  - "contract:command-suggestion-flow"
load_context:
  - "contexts/contracts/command-suggestion-flow.md"
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
# obligation: line 18
obligation_frequency: "per-turn"
---

# Command Suggestion Policy

When the user's prompt matches an eligible slash command, surface it as a
**numbered option** alongside an "as-is" escape hatch. The user always
picks. **Nothing auto-executes.** Flow contract + senior-gate map:
[`contexts/contracts/command-suggestion-flow.md`](../contexts/contracts/command-suggestion-flow.md).

## Iron Law — never auto-execute

```
SUGGEST. NEVER INVOKE. THE USER PICKS, ALWAYS.
```

A suggestion block emits options. It does **not** start a command flow.
The "run as-is" option is **always present**, **always last**, never
removed.

### The single HIGH-tier carve-out — a duplicate confirmation, never a skipped one

```
HIGH TIER REMOVES A SECOND CONFIRMATION. IT NEVER REMOVES THE FIRST.
A COMMAND THAT WOULD BEGIN ACTING ON ARRIVAL IS NEVER HIGH TIER.
TWO CANDIDATES ABOVE THE FLOOR IS MEDIUM. A SUBSTRING HIT IS MEDIUM.
NO DETERMINISTIC UNIQUE SIGNAL → THE BLOCK, ALWAYS.
```

Added by road-to-user-out-of-the-loop Phase 1. It is narrow on purpose, and the
narrowness is the argument: the law above exists so the user is never carried
somewhere they did not choose, and a routed command whose **own** contract
screen is the next thing they see has not carried them anywhere — it has
replaced one options block with one basis line and left the real decision
exactly where it was.

All three conditions in
[`command-suggestion-flow § Tier matrix`](../contexts/contracts/command-suggestion-flow.md)
must hold: a deterministic unique signal, no second candidate above the floor,
and a routed command that shows its own confirmation. Condition 3 is the
load-bearing one — without it this clause would authorise auto-execution, which
is the thing the Iron Law forbids and this carve-out does not touch.

Everything else on this page is unchanged. MEDIUM and LOW still emit the block
with "run as-is" always present and always last; the subordination list below
still makes suggestion junior to every rule on it; and a Hard-Floor action stays
gated by [`non-destructive-by-default`](non-destructive-by-default.md) however
it was reached.

**Honest status:** the kill criterion (>5 % mis-routes over 50 auto-routes
reverts to block-always) has **no instrument yet**. The rate is unmeasured, not
low. A mis-route is a reportable defect until it can be counted.

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
