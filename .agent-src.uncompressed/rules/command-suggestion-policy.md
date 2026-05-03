---
type: "auto"
description: "User prompt without /command but matching an eligible slash command — surface matches as numbered options with as-is escape hatch; never auto-executes, user always picks"
alwaysApply: false
source: package
---

# Command Suggestion

When the user's prompt matches an eligible slash command, surface it
as a **numbered option** alongside an "as-is" escape hatch. The user
always picks. **Nothing auto-executes.** The suggestion layer is a
read-only shortcut *finder*, not an invocation path.

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

## What to emit

Render exactly one numbered-options block conforming to
`user-interaction`:

```
> 💡 Your request matches a command. Pick one or run the prompt as-is:
>
> 1. /implement-ticket — drive ticket end-to-end through refine → plan → implement → test
> 2. /refine-ticket — tighten the AC and risks on a ticket before planning
> 3. Just run the prompt as-is, no command

**Recommendation: 1 — /implement-ticket** — the request matches its trigger description (`setze ticket abc-123 um`). Pick the last option to skip the command and run the prompt as written.
```

Rules — non-negotiable:

- The "run as-is" option is **always present**, **always last**, never removed.
- At most `commands.suggestion.max_options` command suggestions
  precede the as-is option (default 4 → 5 total).
- Exactly **one** `Recommendation:` line follows the block, naming
  the highest-scoring command — or no recommendation when the top
  two scores are within 0.05 of each other (single-source-of-truth
  Iron Law from `user-interaction`).
- Free-text replies count as the as-is option unless they
  unambiguously name one of the listed commands.

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

## Anti-noise — silent when uncertain

The engine's `rank.py` already drops:

- Matches below the `confidence_floor` (default 0.6, per-command
  override in frontmatter).
- Single matches scoring `< floor + 0.1` with no structural bonus
  (high uncertainty isn't worth interrupting for).
- Short prompts (< 6 words) hitting > 2 commands with no structural
  bonus (ticket key, file path) — too vague to disambiguate.
- Pure-continuation messages (`ok`, `weiter`, `mach weiter`, `go on`,
  …) — no new intent signal, no structural bonus → silent.
- Suggestions that fired for the same `(command, evidence)` pair
  within the cooldown window (default 10m, per-command override).

If the engine returns an empty list → emit nothing. The user's
prompt runs exactly as it would without this rule.

## What this rule does NOT do

- Invoke any command. Picking option N is what triggers `slash-command-routing-policy`.
- Stack with other questions. One numbered-options block per turn.
- Re-trigger on its own output. Command names emitted in the
  suggestion block are excluded from the next-turn matcher input.
- Override `enabled: false`, blocklist entries, or per-conversation opt-out.
- Suggest commands that are not in the locked eligibility table.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) the rule is **inert**
unless the suggester package is shipped in the bundle. Treat
`commands.suggestion.enabled` as `false` when the engine is not
available — degrade silently, never crash the turn.

## Interactions

- [`slash-command-routing-policy`](slash-command-routing-policy.md) — explicit `/command` skips suggestion entirely.
- [`user-interaction`](user-interaction.md) — numbered-options Iron Law and single-source recommendation.
- [`ask-when-uncertain`](ask-when-uncertain.md) — clarification wins on conflict.
- [`scope-control`](scope-control.md) — git-op gates outrank suggestion.
- [`role-mode-adherence`](role-mode-adherence.md) — active mode contract outranks suggestion.
- [`agents/contexts/command-suggestion-eligibility.md`](../../agents/contexts/command-suggestion-eligibility.md) — locked eligibility table.
