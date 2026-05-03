# Command Suggestion — mechanics

Output format, anti-noise specifics, and "what this rule does NOT do"
catalog for the
[`command-suggestion-policy`](../../../rules/command-suggestion-policy.md)
rule. The Iron Law (suggest, never invoke), the six-condition fire
gate, and the subordination list live in the rule; this file is the
lookup material for the rendered output and engine behavior.

## What to emit — exact format

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
